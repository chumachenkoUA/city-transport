-- ============================================================================
-- 0003_passenger_api.sql - API для авторизованих пасажирів
-- ============================================================================
-- Цей файл створює API для пасажирів (ct_passenger_role):
-- - Перегляд своїх карток, квитків, штрафів
-- - Поповнення картки та покупка квитків
-- - Подання скарг та апеляцій на штрафи
-- - Оплата штрафів
-- - GPS логування (для пошуку найближчих зупинок)
--
-- ВАЖЛИВО: Всі VIEW мають security_barrier = true
-- Це запобігає витоку даних через оптимізацію запитів
-- ============================================================================

-- ============================================================================
-- 1. VIEW - Особисті дані пасажира
-- ============================================================================
-- security_barrier = true: захист від leaky views
-- session_user: PostgreSQL login поточного користувача

-- Мої транспортні картки (зазвичай одна)
CREATE OR REPLACE VIEW passenger_api.v_my_cards WITH (security_barrier = true) AS
SELECT tc.id, tc.card_number, tc.balance,
       (SELECT MAX(topped_up_at) FROM public.card_top_ups WHERE card_id = tc.id) as last_top_up
FROM public.transport_cards tc
JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_my_trips WITH (security_barrier = true) AS
SELECT t.id as ticket_id, t.purchased_at, t.price, r.number AS route_number,
       tt.name AS transport_type
FROM public.tickets t
JOIN public.transport_cards tc ON tc.id = t.card_id
JOIN public.users u ON u.id = tc.user_id
JOIN public.trips tr ON tr.id = t.trip_id
JOIN public.routes r ON r.id = tr.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE u.login = session_user
ORDER BY t.purchased_at DESC;

CREATE OR REPLACE VIEW passenger_api.v_my_fines WITH (security_barrier = true) AS
SELECT f.id, f.amount, f.reason, f.status, f.issued_at
FROM public.fines f
JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_my_appeals WITH (security_barrier = true) AS
SELECT fa.id, fa.fine_id, fa.message, fa.status, fa.created_at
FROM public.fine_appeals fa
JOIN public.fines f ON f.id = fa.fine_id
JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

-- Історія поповнень картки
CREATE OR REPLACE VIEW passenger_api.v_my_top_ups WITH (security_barrier = true) AS
SELECT ctu.id, ctu.amount, ctu.topped_up_at
FROM public.card_top_ups ctu
JOIN public.transport_cards tc ON tc.id = ctu.card_id
JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user
ORDER BY ctu.topped_up_at DESC;

-- NOTE: v_transport_at_stops removed - use guest_api views (v_route_stops, v_routes, v_schedules) instead
-- Guest service provides better implementation with nextArrivalMin calculation

-- 2. Complaint Function
-- VALIDATION: If route_number/transport_type provided but not found - raise exception
CREATE OR REPLACE FUNCTION passenger_api.submit_complaint(
    p_type text,
    p_message text,
    p_route_number text DEFAULT NULL,
    p_transport_type text DEFAULT NULL,
    p_vehicle_number text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_route_id INT;
    v_vehicle_id BIGINT;
    v_id bigint;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Validate complaint type
    IF p_type NOT IN ('complaint', 'suggestion') THEN
        RAISE EXCEPTION 'Invalid type: %. Must be complaint or suggestion', p_type;
    END IF;

    -- Validate message length
    IF length(p_message) > 5000 THEN
        RAISE EXCEPTION 'Message too long (max 5000 characters)';
    END IF;

    -- Validate route if provided
    IF p_route_number IS NOT NULL AND p_transport_type IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        JOIN public.transport_types tt ON tt.id = r.transport_type_id
        WHERE r.number = p_route_number AND tt.name = p_transport_type
        LIMIT 1;

        IF v_route_id IS NULL THEN
            RAISE EXCEPTION 'Route not found: % (%)', p_route_number, p_transport_type;
        END IF;
    END IF;

    -- Validate vehicle if provided
    IF p_vehicle_number IS NOT NULL THEN
        SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_vehicle_number LIMIT 1;

        IF v_vehicle_id IS NULL THEN
            RAISE EXCEPTION 'Vehicle not found: %', p_vehicle_number;
        END IF;
    END IF;

    INSERT INTO public.complaints_suggestions (user_id, type, message, status, created_at, route_id, vehicle_id)
    VALUES (v_user_id, p_type, p_message, 'Подано', now(), v_route_id, v_vehicle_id)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- 3. Fine Appeal Function
-- ============================================================================
-- submit_fine_appeal - Подання апеляції на штраф
-- ============================================================================
-- Перевірки:
-- 1. Штраф існує і належить поточному користувачу
-- 2. Статус штрафу дозволяє оскарження ('Очікує сплати')
-- 3. Апеляція ще не подана (UNIQUE constraint на fine_id)
-- Після успішного створення апеляції - статус штрафу → 'В процесі'
CREATE OR REPLACE FUNCTION passenger_api.submit_fine_appeal(p_fine_id bigint, p_message text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_fine_user_id bigint;
    v_fine_status text;
    v_id bigint;
BEGIN
    -- Отримати ID поточного користувача
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;

    -- Отримати дані штрафу
    SELECT user_id, status INTO v_fine_user_id, v_fine_status
    FROM public.fines WHERE id = p_fine_id;

    -- Перевірка: штраф існує
    IF v_fine_user_id IS NULL THEN
        RAISE EXCEPTION 'Штраф не знайдено';
    END IF;

    -- Перевірка: це штраф поточного користувача
    IF v_fine_user_id != v_user_id THEN
        RAISE EXCEPTION 'Це не ваш штраф';
    END IF;

    -- Перевірка: статус дозволяє оскарження
    IF v_fine_status = 'В процесі' THEN
        RAISE EXCEPTION 'Апеляцію на цей штраф вже подано';
    END IF;
    IF v_fine_status = 'Оплачено' THEN
        RAISE EXCEPTION 'Оплачений штраф не можна оскаржити';
    END IF;
    IF v_fine_status = 'Відмінено' THEN
        RAISE EXCEPTION 'Штраф вже відмінено';
    END IF;

    -- Перевірка: апеляція ще не існує (додаткова перевірка перед UNIQUE constraint)
    IF EXISTS (SELECT 1 FROM public.fine_appeals WHERE fine_id = p_fine_id) THEN
        RAISE EXCEPTION 'Апеляцію на цей штраф вже подано раніше';
    END IF;

    -- Створити апеляцію
    INSERT INTO public.fine_appeals (fine_id, message, status, created_at)
    VALUES (p_fine_id, p_message, 'Подано', now())
    RETURNING id INTO v_id;

    -- Оновити статус штрафу на 'В процесі'
    UPDATE public.fines SET status = 'В процесі' WHERE id = p_fine_id;

    RETURN v_id;
END;
$$;

-- 4. Ticket Purchase
-- SECURITY: Uses FOR UPDATE to prevent race conditions (double-spending)
CREATE OR REPLACE FUNCTION passenger_api.buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_bal numeric; v_tid bigint; v_uid bigint;
BEGIN
    -- Validate price
    IF p_price <= 0 THEN
        RAISE EXCEPTION 'Price must be positive';
    END IF;

    -- Validate trip exists
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id) THEN
        RAISE EXCEPTION 'Trip not found';
    END IF;

    -- Lock the card row to prevent concurrent balance modifications
    SELECT user_id, balance INTO v_uid, v_bal
    FROM public.transport_cards
    WHERE id = p_card_id
    FOR UPDATE;

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Card not found';
    END IF;

    IF (SELECT id FROM public.users WHERE login = session_user) != v_uid THEN
        RAISE EXCEPTION 'Not your card';
    END IF;

    IF v_bal < p_price THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.transport_cards SET balance = balance - p_price WHERE id = p_card_id;
    INSERT INTO public.tickets (card_id, trip_id, price, purchased_at)
    VALUES (p_card_id, p_trip_id, p_price, now()) RETURNING id INTO v_tid;
    RETURN v_tid;
END;
$$;

-- 5. Card Top Up
-- SECURITY: Only card owner can top up their own card
CREATE OR REPLACE FUNCTION passenger_api.top_up_card(p_card text, p_amt numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_cid bigint;
BEGIN
    -- Validate amount
    IF p_amt <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    -- Select card only if it belongs to current user
    SELECT tc.id INTO v_cid
    FROM public.transport_cards tc
    JOIN public.users u ON u.id = tc.user_id
    WHERE tc.card_number = p_card AND u.login = session_user;

    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Card not found or not yours';
    END IF;

    UPDATE public.transport_cards SET balance = balance + p_amt WHERE id = v_cid;
    INSERT INTO public.card_top_ups (card_id, amount, topped_up_at) VALUES (v_cid, p_amt, now());
END;
$$;

-- 6. Search Functions
-- NOTE: find_stops_nearby() removed - use guest_api.find_nearby_stops() instead
-- Passenger role has access to guest_api functions

CREATE OR REPLACE FUNCTION passenger_api.find_routes_between(
    p_start_lon numeric, p_start_lat numeric,
    p_end_lon numeric, p_end_lat numeric,
    p_radius_m integer DEFAULT 800
)
RETURNS TABLE (route_id bigint, route_number text, transport_type text, start_stop_name text, end_stop_name text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT r.id, r.number::text, tt.name::text, s1.name::text, s2.name::text
    FROM public.routes r
    JOIN public.transport_types tt ON tt.id = r.transport_type_id
    JOIN public.route_stops rs1 ON rs1.route_id = r.id
    JOIN public.stops s1 ON s1.id = rs1.stop_id
    JOIN public.route_stops rs2 ON rs2.route_id = r.id
    JOIN public.stops s2 ON s2.id = rs2.stop_id
    WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(s1.lon, s1.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)::geography, p_radius_m)
      AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(s2.lon, s2.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)::geography, p_radius_m)
      AND rs1.id < rs2.id;
END;
$$;

-- 7. Pay Fine Function
-- SECURITY: Uses FOR UPDATE to prevent race conditions (double-spending)
CREATE OR REPLACE FUNCTION passenger_api.pay_fine(p_fine_id bigint, p_card_id bigint)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_fine_user_id bigint;
    v_fine_amount numeric;
    v_fine_status text;
    v_card_user_id bigint;
    v_card_balance numeric;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Lock the fine row to prevent concurrent payment attempts
    SELECT user_id, amount, status INTO v_fine_user_id, v_fine_amount, v_fine_status
    FROM public.fines WHERE id = p_fine_id
    FOR UPDATE;

    IF v_fine_user_id IS NULL THEN RAISE EXCEPTION 'Fine not found'; END IF;
    IF v_fine_user_id != v_user_id THEN RAISE EXCEPTION 'Not your fine'; END IF;
    IF v_fine_status = 'Оплачено' THEN RAISE EXCEPTION 'Fine is already paid'; END IF;
    IF v_fine_status = 'Відмінено' THEN RAISE EXCEPTION 'Fine is cancelled'; END IF;

    -- Lock the card row to prevent concurrent balance modifications
    SELECT user_id, balance INTO v_card_user_id, v_card_balance
    FROM public.transport_cards WHERE id = p_card_id
    FOR UPDATE;

    IF v_card_user_id IS NULL THEN RAISE EXCEPTION 'Card not found'; END IF;
    IF v_card_user_id != v_user_id THEN RAISE EXCEPTION 'Not your card'; END IF;
    IF v_card_balance < v_fine_amount THEN RAISE EXCEPTION 'Insufficient balance on card'; END IF;

    UPDATE public.transport_cards SET balance = balance - v_fine_amount WHERE id = p_card_id;
    UPDATE public.fines SET status = 'Оплачено' WHERE id = p_fine_id;
END;
$$;

-- 8. User Profile View
CREATE OR REPLACE VIEW passenger_api.v_my_profile WITH (security_barrier = true) AS
SELECT u.id, u.login, u.full_name, u.email, u.phone, u.registered_at
FROM public.users u
WHERE u.login = session_user;

-- 9. GPS Logging Function for Passengers
-- Allows passengers to log their location (for trip tracking, nearby stops, etc.)
CREATE OR REPLACE FUNCTION passenger_api.log_my_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp DEFAULT now())
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_log_id bigint;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Validate coordinates
    IF p_lon < -180 OR p_lon > 180 THEN
        RAISE EXCEPTION 'Invalid longitude: must be between -180 and 180';
    END IF;
    IF p_lat < -90 OR p_lat > 90 THEN
        RAISE EXCEPTION 'Invalid latitude: must be between -90 and 90';
    END IF;

    INSERT INTO public.user_gps_logs (user_id, lon, lat, recorded_at)
    VALUES (v_user_id, p_lon, p_lat, p_recorded_at)
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;

-- View for passenger's own GPS history
CREATE OR REPLACE VIEW passenger_api.v_my_gps_history WITH (security_barrier = true) AS
SELECT ugl.id, ugl.lon, ugl.lat, ugl.recorded_at
FROM public.user_gps_logs ugl
JOIN public.users u ON u.id = ugl.user_id
WHERE u.login = session_user
ORDER BY ugl.recorded_at DESC;

-- 10. Grants
GRANT SELECT ON ALL TABLES IN SCHEMA passenger_api TO ct_passenger_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA passenger_api TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.pay_fine(bigint, bigint) TO ct_passenger_role;
