-- 0002_guest_api.sql
-- Guest API: Views and functions for unauthenticated users

-- 1. Trigram index for stop name search
CREATE INDEX IF NOT EXISTS idx_stops_name_trgm ON public.stops USING gin (name gin_trgm_ops);

-- 2. Basic Views
CREATE OR REPLACE VIEW guest_api.v_transport_types AS
SELECT id, name FROM public.transport_types;

CREATE OR REPLACE VIEW guest_api.v_stops AS
SELECT id, name, lon, lat FROM public.stops;

CREATE OR REPLACE VIEW guest_api.v_routes AS
SELECT r.id, r.number, r.direction, r.transport_type_id, tt.name AS transport_type_name
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE r.is_active = true;

CREATE OR REPLACE VIEW guest_api.v_route_stops AS
SELECT rs.id, rs.route_id, rs.stop_id, s.name AS stop_name, s.lon, s.lat,
       rs.distance_to_next_km, rs.prev_route_stop_id, rs.next_route_stop_id
FROM public.route_stops rs
JOIN public.stops s ON s.id = rs.stop_id;

CREATE OR REPLACE VIEW guest_api.v_route_points AS
SELECT * FROM public.route_points;

CREATE OR REPLACE VIEW guest_api.v_schedules AS
SELECT route_id, work_start_time, work_end_time, interval_min,
       monday, tuesday, wednesday, thursday, friday, saturday, sunday,
       valid_from, valid_to, vehicle_id
FROM public.schedules;

-- 3. Route Geometries (Recursive CTE for ordered points)
CREATE OR REPLACE VIEW guest_api.v_route_geometries AS
WITH RECURSIVE ordered_points AS (
    SELECT rp.route_id, rp.id, rp.lon::float8 as lon, rp.lat::float8 as lat, 1 AS sort_order
    FROM public.route_points rp
    WHERE rp.prev_route_point_id IS NULL
    UNION ALL
    SELECT next_p.route_id, next_p.id, next_p.lon::float8 as lon, next_p.lat::float8 as lat, op.sort_order + 1
    FROM public.route_points next_p
    JOIN ordered_points op ON next_p.prev_route_point_id = op.id
)
SELECT
    r.id AS route_id,
    r.number,
    tt.name AS transport_type,
    r.direction,
    r.transport_type_id,
    ST_AsGeoJSON(ST_MakeLine(ST_SetSRID(ST_MakePoint(op.lon, op.lat), 4326) ORDER BY op.sort_order))::jsonb AS geometry
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id
JOIN ordered_points op ON op.route_id = r.id
WHERE r.is_active = true
GROUP BY r.id, r.number, tt.name, r.direction, r.transport_type_id;

CREATE OR REPLACE VIEW guest_api.v_stop_geometries AS
SELECT s.id, s.name,
       ST_AsGeoJSON(ST_SetSRID(ST_MakePoint(s.lon::float8, s.lat::float8), 4326))::jsonb AS geometry
FROM public.stops s;

-- 4. Search Functions
CREATE OR REPLACE FUNCTION guest_api.find_nearby_stops(
    p_lon numeric,
    p_lat numeric,
    p_radius_m numeric,
    p_limit integer DEFAULT 10
)
RETURNS TABLE (id bigint, name text, lon numeric, lat numeric, distance_m double precision)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.lon, s.lat,
           ST_Distance(
               ST_SetSRID(ST_MakePoint(p_lon::float8, p_lat::float8), 4326)::geography,
               ST_SetSRID(ST_MakePoint(s.lon::float8, s.lat::float8), 4326)::geography
           ) AS distance_m
    FROM public.stops s
    WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(p_lon::float8, p_lat::float8), 4326)::geography,
        ST_SetSRID(ST_MakePoint(s.lon::float8, s.lat::float8), 4326)::geography,
        p_radius_m
    )
    ORDER BY distance_m
    LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer DEFAULT 10)
RETURNS TABLE (id bigint, name text, lon numeric, lat numeric)
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
    SELECT s.id, s.name, s.lon, s.lat
    FROM stops s
    WHERE s.name ILIKE '%' || p_query || '%'
    ORDER BY CASE WHEN s.name ILIKE p_query || '%' THEN 1 ELSE 2 END, s.name
    LIMIT p_limit;
$$;

-- 5. Route Planning
CREATE OR REPLACE FUNCTION guest_api.plan_route(
    p_lon_a numeric, p_lat_a numeric,
    p_lon_b numeric, p_lat_b numeric,
    p_radius_m numeric DEFAULT 500,
    p_max_wait_min integer DEFAULT 10,
    p_max_results integer DEFAULT 5
)
RETURNS TABLE (route_option jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_current_time time;
    v_current_minutes integer;
BEGIN
    v_current_time := CURRENT_TIME;
    v_current_minutes := EXTRACT(HOUR FROM v_current_time) * 60 + EXTRACT(MINUTE FROM v_current_time);

    RETURN QUERY
    WITH
    stops_a AS (
        SELECT id, name, lon, lat, distance_m
        FROM guest_api.find_nearby_stops(p_lon_a, p_lat_a, p_radius_m, 3)
    ),
    stops_b AS (
        SELECT id, name, lon, lat, distance_m
        FROM guest_api.find_nearby_stops(p_lon_b, p_lat_b, p_radius_m, 3)
    ),
    potential_routes AS (
        SELECT DISTINCT r.id, r.number, r.transport_type_id, r.direction, tt.name as transport_type
        FROM routes r
        JOIN route_stops rsa ON rsa.route_id = r.id
        JOIN stops_a sa ON rsa.stop_id = sa.id
        JOIN route_stops rsb ON rsb.route_id = r.id
        JOIN stops_b sb ON rsb.stop_id = sb.id
        JOIN transport_types tt ON tt.id = r.transport_type_id
        WHERE r.is_active = true
    ),
    route_paths AS (
        SELECT rp.route_id, rp.stop_id, rp.path_seq, rp.accum_dist
        FROM (
            WITH RECURSIVE traversal AS (
                SELECT rs.id, rs.route_id, rs.stop_id, rs.next_route_stop_id, rs.distance_to_next_km,
                       1 as path_seq, 0::numeric as accum_dist
                FROM route_stops rs
                JOIN potential_routes pr ON rs.route_id = pr.id
                WHERE rs.prev_route_stop_id IS NULL
                UNION ALL
                SELECT next_rs.id, next_rs.route_id, next_rs.stop_id, next_rs.next_route_stop_id,
                       next_rs.distance_to_next_km, t.path_seq + 1,
                       t.accum_dist + COALESCE(t.distance_to_next_km, 0)::numeric
                FROM route_stops next_rs
                JOIN traversal t ON next_rs.id = t.next_route_stop_id
                WHERE t.path_seq < 1000
            )
            SELECT t.route_id, t.stop_id, t.path_seq, t.accum_dist FROM traversal t
        ) rp
    ),
    valid_segments AS (
        SELECT pr.id AS route_id, pr.number AS route_number, pr.transport_type,
               pr.transport_type_id, pr.direction, sa.id AS stop_a_id, sb.id AS stop_b_id,
               (rb.accum_dist - ra.accum_dist) AS distance_km
        FROM potential_routes pr
        JOIN route_paths ra ON ra.route_id = pr.id
        JOIN stops_a sa ON ra.stop_id = sa.id
        JOIN route_paths rb ON rb.route_id = pr.id
        JOIN stops_b sb ON rb.stop_id = sb.id
        WHERE ra.path_seq < rb.path_seq
    ),
    segments_with_schedule AS (
        SELECT vs.*,
               ROUND((vs.distance_km / 25.0) * 60)::integer AS travel_min,
               (CASE WHEN s.interval_min > 0 THEN
                   EXTRACT(HOUR FROM s.work_start_time)::integer * 60 +
                   EXTRACT(MINUTE FROM s.work_start_time)::integer +
                   (CEIL(GREATEST(0, v_current_minutes - (EXTRACT(HOUR FROM s.work_start_time)::integer * 60 +
                    EXTRACT(MINUTE FROM s.work_start_time)::integer))::numeric / s.interval_min) * s.interval_min)
               ELSE NULL END)::integer AS next_departure_min
        FROM valid_segments vs
        LEFT JOIN schedules s ON s.route_id = vs.route_id
        WHERE vs.distance_km > 0 AND s.interval_min > 0 AND s.work_start_time IS NOT NULL
    )
    SELECT jsonb_build_object(
        'totalTimeMin', sws.travel_min,
        'totalDistanceKm', sws.distance_km,
        'transferCount', 0,
        'segments', jsonb_build_array(jsonb_build_object(
            'routeId', sws.route_id,
            'routeNumber', sws.route_number,
            'transportType', sws.transport_type,
            'transportTypeId', sws.transport_type_id,
            'direction', sws.direction,
            'fromStop', jsonb_build_object(
                'id', sws.stop_a_id,
                'name', (SELECT name FROM stops WHERE id = sws.stop_a_id),
                'lon', (SELECT lon FROM stops WHERE id = sws.stop_a_id),
                'lat', (SELECT lat FROM stops WHERE id = sws.stop_a_id)
            ),
            'toStop', jsonb_build_object(
                'id', sws.stop_b_id,
                'name', (SELECT name FROM stops WHERE id = sws.stop_b_id),
                'lon', (SELECT lon FROM stops WHERE id = sws.stop_b_id),
                'lat', (SELECT lat FROM stops WHERE id = sws.stop_b_id)
            ),
            'distanceKm', sws.distance_km,
            'travelTimeMin', sws.travel_min,
            'departureTime', TO_CHAR((sws.next_departure_min || ' minutes')::interval, 'HH24:MI'),
            'arrivalTime', TO_CHAR((sws.next_departure_min + sws.travel_min || ' minutes')::interval, 'HH24:MI')
        ))
    ) AS route_option
    FROM segments_with_schedule sws
    WHERE sws.next_departure_min IS NOT NULL
    ORDER BY sws.travel_min
    LIMIT p_max_results;
END;
$$;

-- 6. pgRouting route planning
CREATE OR REPLACE FUNCTION guest_api.plan_route_pgrouting(
    p_start_stop_ids bigint[],
    p_end_stop_ids bigint[],
    p_transfer_penalty integer DEFAULT 8,
    p_max_paths integer DEFAULT 5
)
RETURNS TABLE (
    seq integer, node bigint, edge bigint, cost double precision,
    agg_cost double precision, route_id bigint, stop_id bigint, path_id integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_edge_count integer;
    v_edges_sql text;
    v_start_nodes bigint[];
    v_end_nodes bigint[];
BEGIN
    SELECT array_agg(rs.id) INTO v_start_nodes
    FROM public.route_stops rs WHERE rs.stop_id = ANY(p_start_stop_ids);

    SELECT array_agg(rs.id) INTO v_end_nodes
    FROM public.route_stops rs WHERE rs.stop_id = ANY(p_end_stop_ids);

    IF v_start_nodes IS NULL OR v_end_nodes IS NULL THEN RETURN; END IF;

    SELECT count(*) INTO v_edge_count
    FROM public.route_stops rs
    WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL;

    v_edges_sql := format($f$
        SELECT id, source, target, cost, reverse_cost FROM (
            SELECT row_number() OVER () AS id, rs.id AS source, rs.next_route_stop_id AS target,
                   (COALESCE(rs.distance_to_next_km, 0) / 25.0) * 60.0 AS cost,
                   -1::double precision AS reverse_cost
            FROM public.route_stops rs
            WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL
            UNION ALL
            SELECT row_number() OVER () + %s AS id, rs_from.id AS source, rs_to.id AS target,
                   %s::double precision AS cost, -1::double precision AS reverse_cost
            FROM public.route_stops rs_from
            JOIN public.route_stops rs_to ON rs_from.stop_id = rs_to.stop_id AND rs_from.id <> rs_to.id
        ) edges
    $f$, v_edge_count, p_transfer_penalty);

    RETURN QUERY
    WITH edges AS (
        SELECT row_number() OVER () AS id, rs.id AS source, rs.next_route_stop_id AS target,
               (COALESCE(rs.distance_to_next_km, 0) / 25.0) * 60.0 AS cost,
               -1::double precision AS reverse_cost, rs.route_id AS route_id
        FROM public.route_stops rs
        WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL
        UNION ALL
        SELECT row_number() OVER () + v_edge_count AS id, rs_from.id AS source, rs_to.id AS target,
               p_transfer_penalty::double precision AS cost, -1::double precision AS reverse_cost,
               NULL::bigint AS route_id
        FROM public.route_stops rs_from
        JOIN public.route_stops rs_to ON rs_from.stop_id = rs_to.stop_id AND rs_from.id <> rs_to.id
    ),
    path AS (
        SELECT * FROM pgr_dijkstra(v_edges_sql, v_start_nodes, v_end_nodes, directed := true)
    ),
    best AS (
        SELECT p.start_vid, p.end_vid, MIN(p.agg_cost) AS total_cost
        FROM path p GROUP BY p.start_vid, p.end_vid
    ),
    ranked AS (
        SELECT b.start_vid, b.end_vid, b.total_cost,
               row_number() OVER (ORDER BY b.total_cost) AS path_id
        FROM best b ORDER BY b.total_cost LIMIT p_max_paths
    )
    SELECT p.seq, p.node, p.edge, p.cost, p.agg_cost, e.route_id, rs.stop_id, r.path_id::integer
    FROM path p
    JOIN ranked r ON r.start_vid = p.start_vid AND r.end_vid = p.end_vid
    LEFT JOIN edges e ON e.id = p.edge
    LEFT JOIN public.route_stops rs ON rs.id = p.node
    ORDER BY r.path_id, p.seq;
END;
$$;

-- 7. Complaints submission
CREATE OR REPLACE FUNCTION guest_api.submit_complaint(
    p_type text,
    p_message text,
    p_contact_info text DEFAULT NULL,
    p_route_number text DEFAULT NULL,
    p_transport_type text DEFAULT NULL,
    p_vehicle_number text DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_route_id INT;
    v_vehicle_id BIGINT;
BEGIN
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
        user_id, type, message, trip_id, status, created_at,
        route_id, vehicle_id, contact_info
    )
    VALUES (NULL, p_type, p_message, NULL, 'Подано', now(), v_route_id, v_vehicle_id, p_contact_info);
END;
$$;

-- 8. Grants
GRANT SELECT ON ALL TABLES IN SCHEMA guest_api TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;
GRANT SELECT ON guest_api.v_schedules TO ct_driver_role, ct_passenger_role, ct_guest_role;
GRANT EXECUTE ON FUNCTION guest_api.find_nearby_stops(numeric, numeric, numeric, integer) TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;
GRANT EXECUTE ON FUNCTION guest_api.search_stops_by_name(text, integer) TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role;
GRANT EXECUTE ON FUNCTION guest_api.plan_route(numeric, numeric, numeric, numeric, numeric, integer, integer) TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role;
GRANT EXECUTE ON FUNCTION guest_api.plan_route_pgrouting(bigint[], bigint[], integer, integer) TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role;
GRANT EXECUTE ON FUNCTION guest_api.submit_complaint(text, text, text, text, text, text) TO ct_guest_role, ct_passenger_role;
