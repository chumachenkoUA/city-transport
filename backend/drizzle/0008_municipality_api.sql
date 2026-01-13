-- 0008_municipality_api.sql
-- Municipality API: Route management and analytics

-- 1. BASIC FUNCTIONS
CREATE OR REPLACE FUNCTION municipality_api.create_stop(p_name text, p_lon numeric, p_lat numeric)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.stops (name, lon, lat) VALUES (p_name, p_lon, p_lat) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION municipality_api.update_stop(p_id bigint, p_name text, p_lon numeric, p_lat numeric)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.stops SET name = p_name, lon = p_lon, lat = p_lat WHERE id = p_id;
END;
$$;

-- 2. ROUTE CREATION (full with stops and points)
CREATE OR REPLACE FUNCTION municipality_api.create_route_full(
    p_number text,
    p_transport_type_id integer,
    p_direction text,
    p_stops_json jsonb,
    p_points_json jsonb
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_route_id bigint;
    v_stop record;
    v_point record;
    v_prev_stop_id bigint := NULL;
    v_current_stop_id bigint;
    v_new_stop_id bigint;
    v_prev_point_id bigint := NULL;
    v_current_point_id bigint;
BEGIN
    INSERT INTO public.routes (number, transport_type_id, direction, is_active)
    VALUES (p_number, p_transport_type_id, p_direction, true)
    RETURNING id INTO v_route_id;

    FOR v_stop IN
        SELECT * FROM jsonb_to_recordset(p_stops_json)
            AS x(stop_id bigint, name text, lon numeric, lat numeric, distance_to_next_km numeric)
    LOOP
        IF v_stop.stop_id IS NOT NULL THEN
            v_new_stop_id := v_stop.stop_id;
        ELSE
            INSERT INTO public.stops (name, lon, lat)
            VALUES (v_stop.name, v_stop.lon, v_stop.lat)
            RETURNING id INTO v_new_stop_id;
        END IF;

        INSERT INTO public.route_stops (route_id, stop_id, prev_route_stop_id, distance_to_next_km)
        VALUES (v_route_id, v_new_stop_id, v_prev_stop_id, v_stop.distance_to_next_km)
        RETURNING id INTO v_current_stop_id;

        IF v_prev_stop_id IS NOT NULL THEN
            UPDATE public.route_stops SET next_route_stop_id = v_current_stop_id WHERE id = v_prev_stop_id;
        END IF;

        v_prev_stop_id := v_current_stop_id;
    END LOOP;

    FOR v_point IN
        SELECT * FROM jsonb_to_recordset(p_points_json) AS x(lon numeric, lat numeric)
    LOOP
        INSERT INTO public.route_points (route_id, lon, lat, prev_route_point_id)
        VALUES (v_route_id, v_point.lon, v_point.lat, v_prev_point_id)
        RETURNING id INTO v_current_point_id;

        IF v_prev_point_id IS NOT NULL THEN
            UPDATE public.route_points SET next_route_point_id = v_current_point_id WHERE id = v_prev_point_id;
        END IF;

        v_prev_point_id := v_current_point_id;
    END LOOP;

    PERFORM municipality_api.recalculate_route_stop_distances(v_route_id);

    RETURN v_route_id;
END;
$$;

-- 3. RECALCULATE DISTANCES
CREATE OR REPLACE FUNCTION municipality_api.recalculate_route_stop_distances(p_route_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_points_count integer;
    v_stops_count integer;
BEGIN
    SELECT count(*) INTO v_points_count FROM public.route_points WHERE route_id = p_route_id;
    SELECT count(*) INTO v_stops_count FROM public.route_stops WHERE route_id = p_route_id;

    IF v_points_count < 2 OR v_stops_count < 2 THEN RETURN; END IF;

    WITH RECURSIVE ordered_points AS (
        SELECT rp.id, rp.route_id, rp.lon, rp.lat, rp.prev_route_point_id, 1 AS sort_order
        FROM public.route_points rp
        WHERE rp.route_id = p_route_id AND rp.prev_route_point_id IS NULL
        UNION ALL
        SELECT next_p.id, next_p.route_id, next_p.lon, next_p.lat, next_p.prev_route_point_id, op.sort_order + 1
        FROM public.route_points next_p
        JOIN ordered_points op ON next_p.prev_route_point_id = op.id
    ),
    point_distances AS (
        SELECT id, route_id, lon, lat, sort_order,
               SUM(COALESCE(ST_DistanceSphere(
                   ST_MakePoint(lon::double precision, lat::double precision),
                   ST_MakePoint(LAG(lon) OVER (ORDER BY sort_order)::double precision,
                                LAG(lat) OVER (ORDER BY sort_order)::double precision)
               ), 0)) OVER (ORDER BY sort_order) / 1000.0 AS distance_km
        FROM ordered_points
    ),
    ordered_stops AS (
        SELECT rs.id, rs.stop_id, rs.prev_route_stop_id, rs.next_route_stop_id, 1 AS sort_order
        FROM public.route_stops rs
        WHERE rs.route_id = p_route_id AND rs.prev_route_stop_id IS NULL
        UNION ALL
        SELECT rs.id, rs.stop_id, rs.prev_route_stop_id, rs.next_route_stop_id, os.sort_order + 1
        FROM public.route_stops rs
        JOIN ordered_stops os ON rs.prev_route_stop_id = os.id
    ),
    stop_positions AS (
        SELECT os.id AS route_stop_id, os.next_route_stop_id, pd.sort_order AS point_order, pd.distance_km
        FROM ordered_stops os
        JOIN public.stops s ON s.id = os.stop_id
        JOIN LATERAL (
            SELECT sort_order, distance_km FROM point_distances pd
            ORDER BY ST_DistanceSphere(
                ST_MakePoint(s.lon::double precision, s.lat::double precision),
                ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
            ) LIMIT 1
        ) pd ON true
        WHERE os.prev_route_stop_id IS NULL
        UNION ALL
        SELECT os.id AS route_stop_id, os.next_route_stop_id,
               COALESCE(pd_next.sort_order, pd_any.sort_order) AS point_order,
               COALESCE(pd_next.distance_km, pd_any.distance_km) AS distance_km
        FROM ordered_stops os
        JOIN stop_positions sp ON os.prev_route_stop_id = sp.route_stop_id
        JOIN public.stops s ON s.id = os.stop_id
        LEFT JOIN LATERAL (
            SELECT sort_order, distance_km FROM point_distances pd
            WHERE pd.sort_order >= sp.point_order
            ORDER BY ST_DistanceSphere(
                ST_MakePoint(s.lon::double precision, s.lat::double precision),
                ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
            ) LIMIT 1
        ) pd_next ON true
        LEFT JOIN LATERAL (
            SELECT sort_order, distance_km FROM point_distances pd
            ORDER BY ST_DistanceSphere(
                ST_MakePoint(s.lon::double precision, s.lat::double precision),
                ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
            ) LIMIT 1
        ) pd_any ON true
    ),
    stop_distances AS (
        SELECT sp.route_stop_id, sp.next_route_stop_id,
               (next_sp.distance_km - sp.distance_km) AS distance_to_next_km
        FROM stop_positions sp
        LEFT JOIN stop_positions next_sp ON next_sp.route_stop_id = sp.next_route_stop_id
    )
    UPDATE public.route_stops rs
    SET distance_to_next_km = CASE
        WHEN sd.next_route_stop_id IS NULL THEN NULL
        ELSE GREATEST(sd.distance_to_next_km, 0)
    END
    FROM stop_distances sd WHERE rs.id = sd.route_stop_id;
END;
$$;

-- 4. ANALYTICS FUNCTIONS
CREATE OR REPLACE FUNCTION municipality_api.get_passenger_flow(
    p_start_date date, p_end_date date,
    p_route_number text DEFAULT NULL, p_transport_type text DEFAULT NULL
)
RETURNS TABLE (trip_date date, route_number text, transport_type text, fleet_number text, passenger_count integer)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT t.actual_starts_at::date, r.number, tt.name, v.fleet_number, t.passenger_count
    FROM public.trips t
    JOIN public.routes r ON r.id = t.route_id
    JOIN public.transport_types tt ON tt.id = r.transport_type_id
    LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
    LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
    WHERE t.status = 'completed'
      AND t.actual_starts_at >= p_start_date AND t.actual_starts_at < p_end_date + 1
      AND (p_route_number IS NULL OR r.number = p_route_number)
      AND (p_transport_type IS NULL OR tt.name = p_transport_type)
    ORDER BY t.actual_starts_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION municipality_api.get_complaints(
    p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL,
    p_route_number text DEFAULT NULL, p_transport_type text DEFAULT NULL, p_fleet_number text DEFAULT NULL
)
RETURNS TABLE (id bigint, type text, message text, status text, created_at timestamp, route_number text, transport_type text, fleet_number text, contact_info text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.type, c.message, c.status, c.created_at, r.number, tt.name, v.fleet_number, c.contact_info
    FROM public.complaints_suggestions c
    LEFT JOIN public.routes r ON r.id = c.route_id
    LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
    LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
    WHERE (p_start_date IS NULL OR c.created_at >= p_start_date)
      AND (p_end_date IS NULL OR c.created_at < p_end_date + 1)
      AND (p_route_number IS NULL OR r.number = p_route_number)
      AND (p_transport_type IS NULL OR tt.name = p_transport_type)
      AND (p_fleet_number IS NULL OR v.fleet_number = p_fleet_number)
    ORDER BY c.created_at DESC;
END;
$$;

-- 5. ROUTE & COMPLAINT MANAGEMENT
CREATE OR REPLACE FUNCTION municipality_api.set_route_active(p_route_id bigint, p_is_active boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.routes SET is_active = p_is_active WHERE id = p_route_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION municipality_api.update_complaint_status(p_id bigint, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_status NOT IN ('Подано', 'Розглядається', 'Розглянуто') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;
    UPDATE public.complaints_suggestions SET status = p_status WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found'; END IF;
END;
$$;

-- 6. VIEWS
CREATE OR REPLACE VIEW municipality_api.v_stops AS
SELECT id, name, lon, lat FROM public.stops ORDER BY name;

CREATE OR REPLACE VIEW municipality_api.v_routes AS
SELECT r.id, r.number, r.direction, r.is_active, r.transport_type_id, tt.name AS transport_type
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id
ORDER BY r.number, r.direction;

CREATE OR REPLACE VIEW municipality_api.v_passenger_flow_analytics AS
SELECT t.actual_starts_at::date AS trip_date, r.number AS route_number,
       tt.name AS transport_type, SUM(t.passenger_count)::integer AS passenger_count
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE t.status = 'completed' AND t.actual_starts_at IS NOT NULL
GROUP BY t.actual_starts_at::date, r.number, tt.name
ORDER BY t.actual_starts_at::date DESC;

CREATE OR REPLACE VIEW municipality_api.v_complaints_dashboard AS
SELECT c.id, c.type, c.message, c.status, c.created_at,
       r.number AS route_number, tt.name AS transport_type,
       v.fleet_number, c.contact_info
FROM public.complaints_suggestions c
LEFT JOIN public.routes r ON r.id = c.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
ORDER BY c.created_at DESC;

-- 7. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA municipality_api TO ct_municipality_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA municipality_api TO ct_municipality_role;
GRANT SELECT ON municipality_api.v_routes TO ct_municipality_role;
GRANT SELECT ON municipality_api.v_passenger_flow_analytics TO ct_municipality_role;
GRANT SELECT ON municipality_api.v_complaints_dashboard TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.set_route_active(bigint, boolean) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.update_complaint_status(bigint, text) TO ct_municipality_role;
