-- 0034_tz_requirements.sql

-- 1. DISPATCHER LOGIC
CREATE OR REPLACE FUNCTION dispatcher_api.calculate_delay(p_trip_id bigint)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_route_id bigint;
    v_vehicle_id bigint;
    v_trip_start timestamp;
    v_vehicle_lon numeric;
    v_vehicle_lat numeric;
    v_distance_km numeric;
    v_planned_at timestamp;
    v_delay_min numeric;
BEGIN
    SELECT t.route_id, t.vehicle_id, t.starts_at
    INTO v_route_id, v_vehicle_id, v_trip_start
    FROM public.trips t
    WHERE t.id = p_trip_id;

    IF v_route_id IS NULL OR v_vehicle_id IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT v.last_lon, v.last_lat
    INTO v_vehicle_lon, v_vehicle_lat
    FROM public.vehicles v
    WHERE v.id = v_vehicle_id;

    IF v_vehicle_lon IS NULL OR v_vehicle_lat IS NULL THEN
        RETURN NULL;
    END IF;

    WITH RECURSIVE ordered AS (
        SELECT rs.id,
               rs.route_id,
               rs.stop_id,
               rs.prev_route_stop_id,
               rs.next_route_stop_id,
               rs.distance_to_next_km,
               0::numeric AS distance_from_start
        FROM public.route_stops rs
        WHERE rs.route_id = v_route_id
          AND rs.prev_route_stop_id IS NULL
        UNION ALL
        SELECT rs.id,
               rs.route_id,
               rs.stop_id,
               rs.prev_route_stop_id,
               rs.next_route_stop_id,
               rs.distance_to_next_km,
               o.distance_from_start + COALESCE(o.distance_to_next_km, 0)
        FROM public.route_stops rs
        JOIN ordered o ON rs.prev_route_stop_id = o.id
    )
    SELECT o.distance_from_start
    INTO v_distance_km
    FROM ordered o
    JOIN public.stops s ON s.id = o.stop_id
    ORDER BY ST_DistanceSphere(
        ST_MakePoint(s.lon::double precision, s.lat::double precision),
        ST_MakePoint(v_vehicle_lon::double precision, v_vehicle_lat::double precision)
    )
    LIMIT 1;

    IF v_distance_km IS NULL THEN
        RETURN NULL;
    END IF;

    v_planned_at := v_trip_start + (v_distance_km / 25.0) * interval '1 hour';
    v_delay_min := EXTRACT(EPOCH FROM (now() - v_planned_at)) / 60.0;

    RETURN round(v_delay_min)::integer;
END;
$$;

CREATE OR REPLACE VIEW dispatcher_api.v_active_trip_deviations AS
SELECT *
FROM (
    SELECT
        t.id AS trip_id,
        r.number AS route_number,
        v.fleet_number,
        d.full_name AS driver_name,
        t.starts_at,
        dispatcher_api.calculate_delay(t.id) AS delay_minutes
    FROM public.trips t
    JOIN public.routes r ON r.id = t.route_id
    JOIN public.vehicles v ON v.id = t.vehicle_id
    JOIN public.drivers d ON d.id = t.driver_id
    WHERE t.ends_at IS NULL
) deviations
WHERE deviations.delay_minutes > 5;

-- 2. MUNICIPALITY VIEWS
CREATE OR REPLACE VIEW municipality_api.v_passenger_flow_analytics AS
SELECT
    t.starts_at::date AS trip_date,
    r.number AS route_number,
    tt.name AS transport_type,
    SUM(t.passenger_count)::integer AS passenger_count
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
GROUP BY t.starts_at::date, r.number, tt.name;

CREATE OR REPLACE VIEW municipality_api.v_complaints_dashboard AS
SELECT
    c.id,
    c.type,
    c.message,
    c.status,
    c.created_at,
    r.number AS route_number,
    tt.name AS transport_type,
    v.fleet_number,
    c.contact_info
FROM public.complaints_suggestions c
LEFT JOIN public.routes r ON r.id = c.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
ORDER BY c.created_at DESC;

-- 3. ACCOUNTANT LOGIC
CREATE OR REPLACE VIEW accountant_api.v_financial_report AS
SELECT
    t.purchased_at::date AS report_date,
    'Квитки'::text AS category,
    COALESCE(SUM(t.price), 0) AS amount,
    'income'::text AS type
FROM public.tickets t
GROUP BY t.purchased_at::date
UNION ALL
SELECT
    f.issued_at::date AS report_date,
    'Штрафи'::text AS category,
    COALESCE(SUM(f.amount), 0) AS amount,
    'income'::text AS type
FROM public.fines f
WHERE f.status = 'Оплачено'
GROUP BY f.issued_at::date
UNION ALL
SELECT
    e.occurred_at::date AS report_date,
    e.category,
    COALESCE(SUM(e.amount), 0) AS amount,
    'expense'::text AS type
FROM public.expenses e
GROUP BY e.occurred_at::date, e.category
UNION ALL
SELECT
    sp.paid_at::date AS report_date,
    'Зарплата'::text AS category,
    COALESCE(SUM(sp.total), 0) AS amount,
    'expense'::text AS type
FROM public.salary_payments sp
GROUP BY sp.paid_at::date;

CREATE OR REPLACE FUNCTION accountant_api.calculate_driver_salary(
    p_driver_id bigint,
    p_month date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_rate numeric;
    v_hours numeric;
BEGIN
    SELECT rate
    INTO v_rate
    FROM public.salary_payments
    WHERE driver_id = p_driver_id
      AND rate IS NOT NULL
    ORDER BY paid_at DESC
    LIMIT 1;

    IF v_rate IS NULL THEN
        RAISE EXCEPTION 'Rate not found for driver %', p_driver_id;
    END IF;

    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (t.ends_at - t.starts_at)) / 3600.0), 0)
    INTO v_hours
    FROM public.trips t
    WHERE t.driver_id = p_driver_id
      AND t.starts_at >= date_trunc('month', p_month)
      AND t.starts_at < (date_trunc('month', p_month) + interval '1 month')
      AND t.ends_at IS NOT NULL;

    RETURN round(v_hours * v_rate, 2);
END;
$$;

-- 4. GRANTS
GRANT EXECUTE ON FUNCTION dispatcher_api.calculate_delay(bigint) TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_active_trip_deviations TO ct_dispatcher_role;

GRANT SELECT ON municipality_api.v_passenger_flow_analytics TO ct_municipality_role;
GRANT SELECT ON municipality_api.v_complaints_dashboard TO ct_municipality_role;

GRANT SELECT ON accountant_api.v_financial_report TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.calculate_driver_salary(bigint, date) TO ct_accountant_role;
