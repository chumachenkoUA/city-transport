-- 0009_passenger_api_full.sql

-- 1. ПРЕДСТАВЛЕННЯ (VIEWS) ДЛЯ ПАСАЖИРА

-- Перегляд власних транспортних карток (Вимога 6, 7.2)
CREATE OR REPLACE VIEW passenger_api.v_my_cards AS
SELECT tc.id, tc.card_number, tc.balance,
       (SELECT MAX(topped_up_at) FROM public.card_top_ups WHERE card_id = tc.id) as last_top_up
FROM public.transport_cards tc
         JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user;

-- Перегляд історії здійснених поїздок (Вимога 8)
CREATE OR REPLACE VIEW passenger_api.v_my_trips AS
SELECT t.id as ticket_id, t.purchased_at, t.price, r.number AS route_number, tt.name AS transport_type, tr.starts_at
FROM public.tickets t
         JOIN public.transport_cards tc ON tc.id = t.card_id
         JOIN public.users u ON u.id = tc.user_id
         JOIN public.trips tr ON tr.id = t.trip_id
         JOIN public.routes r ON r.id = tr.route_id
         JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE u.login = session_user
ORDER BY t.purchased_at DESC;

-- Перегляд власних штрафів (Вимога 9, 10.1)
CREATE OR REPLACE VIEW passenger_api.v_my_fines AS
SELECT f.id, f.amount, f.reason, f.status, f.issued_at
FROM public.fines f
         JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

-- Перегляд апеляцій (Вимога 10.2)
CREATE OR REPLACE VIEW passenger_api.v_my_appeals AS
SELECT fa.id, fa.fine_id, fa.message, fa.status, fa.created_at
FROM public.fine_appeals fa
         JOIN public.fines f ON f.id = fa.fine_id
         JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

-- Перегляд транспорту, що проходить через зупинку (Вимога 2)
CREATE OR REPLACE VIEW passenger_api.v_transport_at_stops AS
SELECT
    rs.stop_id,
    r.id as route_id,
    r.number as route_number,
    tt.name as transport_type,
    sch.interval_min as approximate_interval
FROM public.route_stops rs
         JOIN public.routes r ON r.id = rs.route_id
         JOIN public.transport_types tt ON tt.id = r.transport_type_id
         LEFT JOIN public.schedules sch ON sch.route_id = r.id
WHERE r.is_active = true;

-- 2. ФУНКЦІЇ БІЗНЕС-ЛОГІКИ

-- Подача скарги або пропозиції (Вимога 11)
CREATE OR REPLACE FUNCTION passenger_api.submit_complaint(
    p_type text,
    p_message text,
    p_route_number text DEFAULT NULL,
    p_transport_type text DEFAULT NULL,
    p_vehicle_number text DEFAULT NULL
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_catalog
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

    INSERT INTO public.complaints_suggestions (
        user_id, type, message, status, created_at,
        route_id, vehicle_id
    )
    VALUES (
               v_user_id, p_type, p_message, 'Подано', now(),
               v_route_id, v_vehicle_id
           ) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- Оскарження штрафу (Вимога 10.2)
CREATE OR REPLACE FUNCTION passenger_api.submit_fine_appeal(
    p_fine_id bigint,
    p_message text
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_fine_user_id bigint;
    v_id bigint;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    SELECT user_id INTO v_fine_user_id FROM public.fines WHERE id = p_fine_id;

    IF v_fine_user_id IS NULL THEN RAISE EXCEPTION 'Штраф не знайдено'; END IF;
    IF v_fine_user_id != v_user_id THEN RAISE EXCEPTION 'Це не ваш штраф'; END IF;

    INSERT INTO public.fine_appeals (fine_id, message, status, created_at)
    VALUES (p_fine_id, p_message, 'Подано', now())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- ПОШУК (PostGIS)

-- Пошук найближчих зупинок (Вимога 1)
CREATE OR REPLACE FUNCTION passenger_api.find_stops_nearby(
    p_lon numeric,
    p_lat numeric,
    p_radius_m integer DEFAULT 1000
)
    RETURNS TABLE (
                      id bigint,
                      name text,
                      lon numeric,
                      lat numeric,
                      distance_m double precision
                  )
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
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

-- Пошук маршрутів між точками (Вимога 4.1)
CREATE OR REPLACE FUNCTION passenger_api.find_routes_between(
    p_start_lon numeric, p_start_lat numeric,
    p_end_lon numeric, p_end_lat numeric,
    p_radius_m integer DEFAULT 800
)
    RETURNS TABLE (
                      route_id bigint,
                      route_number text,
                      transport_type text,
                      start_stop_name text,
                      end_stop_name text
                  )
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
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
        WHERE
            ST_DWithin(ST_SetSRID(ST_MakePoint(s1.lon, s1.lat), 4326)::geography, ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)::geography, p_radius_m)
          AND
            ST_DWithin(ST_SetSRID(ST_MakePoint(s2.lon, s2.lat), 4326)::geography, ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)::geography, p_radius_m)
          AND rs1.id < rs2.id;
END;
$$;

-- 3. НАДАННЯ ПРАВ (GRANTS)

GRANT SELECT ON passenger_api.v_my_cards TO ct_passenger_role;
GRANT SELECT ON passenger_api.v_my_trips TO ct_passenger_role;
GRANT SELECT ON passenger_api.v_my_fines TO ct_passenger_role;
GRANT SELECT ON passenger_api.v_my_appeals TO ct_passenger_role;
GRANT SELECT ON passenger_api.v_transport_at_stops TO ct_passenger_role;

GRANT EXECUTE ON FUNCTION passenger_api.submit_complaint(text, text, text, text, text) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.submit_fine_appeal(bigint, text) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.find_stops_nearby(numeric, numeric, integer) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.find_routes_between(numeric, numeric, numeric, numeric, integer) TO ct_passenger_role;