-- 0003_passenger_api.sql
-- Passenger API: Views and functions for authenticated passengers

-- 1. Views
CREATE OR REPLACE VIEW passenger_api.v_my_cards AS
SELECT tc.id, tc.card_number, tc.balance,
       (SELECT MAX(topped_up_at) FROM public.card_top_ups WHERE card_id = tc.id) as last_top_up
FROM public.transport_cards tc
JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_my_trips AS
SELECT t.id as ticket_id, t.purchased_at, t.price, r.number AS route_number,
       tt.name AS transport_type, tr.starts_at
FROM public.tickets t
JOIN public.transport_cards tc ON tc.id = t.card_id
JOIN public.users u ON u.id = tc.user_id
JOIN public.trips tr ON tr.id = t.trip_id
JOIN public.routes r ON r.id = tr.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE u.login = session_user
ORDER BY t.purchased_at DESC;

CREATE OR REPLACE VIEW passenger_api.v_my_fines AS
SELECT f.id, f.amount, f.reason, f.status, f.issued_at
FROM public.fines f
JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_my_appeals AS
SELECT fa.id, fa.fine_id, fa.message, fa.status, fa.created_at
FROM public.fine_appeals fa
JOIN public.fines f ON f.id = fa.fine_id
JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_transport_at_stops AS
SELECT rs.stop_id, r.id as route_id, r.number as route_number,
       tt.name as transport_type, sch.interval_min as approximate_interval
FROM public.route_stops rs
JOIN public.routes r ON r.id = rs.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.schedules sch ON sch.route_id = r.id
WHERE r.is_active = true;

-- 2. Complaint Function
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

    IF p_route_number IS NOT NULL AND p_transport_type IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        JOIN public.transport_types tt ON tt.id = r.transport_type_id
        WHERE r.number = p_route_number AND tt.name = p_transport_type
        LIMIT 1;
    END IF;

    IF p_vehicle_number IS NOT NULL THEN
        SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_vehicle_number LIMIT 1;
    END IF;

    INSERT INTO public.complaints_suggestions (user_id, type, message, status, created_at, route_id, vehicle_id)
    VALUES (v_user_id, p_type, p_message, 'Подано', now(), v_route_id, v_vehicle_id)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- 3. Fine Appeal Function
CREATE OR REPLACE FUNCTION passenger_api.submit_fine_appeal(p_fine_id bigint, p_message text)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_fine_user_id bigint;
    v_id bigint;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    SELECT user_id INTO v_fine_user_id FROM public.fines WHERE id = p_fine_id;

    IF v_fine_user_id IS NULL THEN RAISE EXCEPTION 'Fine not found'; END IF;
    IF v_fine_user_id != v_user_id THEN RAISE EXCEPTION 'Not your fine'; END IF;

    INSERT INTO public.fine_appeals (fine_id, message, status, created_at)
    VALUES (p_fine_id, p_message, 'Подано', now())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- 4. Ticket Purchase
CREATE OR REPLACE FUNCTION passenger_api.buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_bal numeric; v_tid bigint; v_uid bigint;
BEGIN
    SELECT user_id, balance INTO v_uid, v_bal FROM public.transport_cards WHERE id = p_card_id;
    IF (SELECT id FROM public.users WHERE login = session_user) != v_uid THEN
        RAISE EXCEPTION 'Not your card';
    END IF;
    IF v_bal < p_price THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    UPDATE public.transport_cards SET balance = balance - p_price WHERE id = p_card_id;
    INSERT INTO public.tickets (card_id, trip_id, price, purchased_at)
    VALUES (p_card_id, p_trip_id, p_price, now()) RETURNING id INTO v_tid;
    RETURN v_tid;
END;
$$;

-- 5. Card Top Up
CREATE OR REPLACE FUNCTION passenger_api.top_up_card(p_card text, p_amt numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cid bigint;
BEGIN
    SELECT id INTO v_cid FROM public.transport_cards WHERE card_number = p_card;
    UPDATE public.transport_cards SET balance = balance + p_amt WHERE id = v_cid;
    INSERT INTO public.card_top_ups (card_id, amount, topped_up_at) VALUES (v_cid, p_amt, now());
END;
$$;

-- 6. Search Functions
CREATE OR REPLACE FUNCTION passenger_api.find_stops_nearby(
    p_lon numeric, p_lat numeric, p_radius_m integer DEFAULT 1000
)
RETURNS TABLE (id bigint, name text, lon numeric, lat numeric, distance_m double precision)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.lon, s.lat,
           ST_Distance(
               ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography,
               ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
           ) AS distance_m
    FROM public.stops s
    WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
        p_radius_m
    )
    ORDER BY distance_m;
END;
$$;

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
    SELECT DISTINCT r.id, r.number, tt.name, s1.name, s2.name
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

    SELECT user_id, amount, status INTO v_fine_user_id, v_fine_amount, v_fine_status
    FROM public.fines WHERE id = p_fine_id;

    IF v_fine_user_id IS NULL THEN RAISE EXCEPTION 'Fine not found'; END IF;
    IF v_fine_user_id != v_user_id THEN RAISE EXCEPTION 'Not your fine'; END IF;
    IF v_fine_status = 'Оплачено' THEN RAISE EXCEPTION 'Fine is already paid'; END IF;

    SELECT user_id, balance INTO v_card_user_id, v_card_balance
    FROM public.transport_cards WHERE id = p_card_id;

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

-- 9. Grants
GRANT SELECT ON ALL TABLES IN SCHEMA passenger_api TO ct_passenger_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA passenger_api TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.pay_fine(bigint, bigint) TO ct_passenger_role;
