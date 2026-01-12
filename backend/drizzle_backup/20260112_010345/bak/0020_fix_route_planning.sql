-- Fix route planning function to handle loops and avoid subquery errors
-- Replaces the recursive CTE logic with a safer approach

CREATE OR REPLACE FUNCTION guest_api.plan_route(
  p_lon_a numeric,
  p_lat_a numeric,
  p_lon_b numeric,
  p_lat_b numeric,
  p_radius_m numeric DEFAULT 500,
  p_max_wait_min integer DEFAULT 10,
  p_max_results integer DEFAULT 5
)
RETURNS TABLE (
  route_option jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_current_time time;
  v_current_minutes integer;
BEGIN
  -- Current time
  v_current_time := CURRENT_TIME;
  v_current_minutes := EXTRACT(HOUR FROM v_current_time) * 60 + EXTRACT(MINUTE FROM v_current_time);

  RETURN QUERY
  WITH
  -- 1. Nearby stops
  stops_a AS (
    SELECT id, name, lon, lat, distance_m
    FROM guest_api.find_nearby_stops(p_lon_a, p_lat_a, p_radius_m, 3)
  ),
  stops_b AS (
    SELECT id, name, lon, lat, distance_m
    FROM guest_api.find_nearby_stops(p_lon_b, p_lat_b, p_radius_m, 3)
  ),

  -- 2. Potential routes (routes touching both stop sets)
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

  -- 3. Unroll paths for potential routes
  -- Calculate sequence and accumulated distance from start of route
  route_paths AS (
    SELECT
      rp.route_id,
      rp.stop_id,
      rp.path_seq,
      rp.accum_dist
    FROM (
      WITH RECURSIVE traversal AS (
        -- Anchor: Start of routes (prev is null)
        SELECT
          rs.id, rs.route_id, rs.stop_id, rs.next_route_stop_id, rs.distance_to_next_km,
          1 as path_seq,
          0::numeric as accum_dist
        FROM route_stops rs
        JOIN potential_routes pr ON rs.route_id = pr.id
        WHERE rs.prev_route_stop_id IS NULL

        UNION ALL

        -- Recursive: Next stop
        SELECT
          next_rs.id, next_rs.route_id, next_rs.stop_id, next_rs.next_route_stop_id, next_rs.distance_to_next_km,
          t.path_seq + 1,
          t.accum_dist + COALESCE(t.distance_to_next_km, 0)::numeric
        FROM route_stops next_rs
        JOIN traversal t ON next_rs.id = t.next_route_stop_id
        -- Safety break
        WHERE t.path_seq < 1000
      )
      SELECT
        t.route_id, t.stop_id, t.path_seq, t.accum_dist
      FROM traversal t
    ) rp
  ),

  -- 4. Find valid segments A -> B
  valid_segments AS (
    SELECT
      pr.id AS route_id,
      pr.number AS route_number,
      pr.transport_type,
      pr.transport_type_id,
      pr.direction,
      sa.id AS stop_a_id,
      sb.id AS stop_b_id,
      (rb.accum_dist - ra.accum_dist) AS distance_km
    FROM potential_routes pr
    JOIN route_paths ra ON ra.route_id = pr.id
    JOIN stops_a sa ON ra.stop_id = sa.id
    JOIN route_paths rb ON rb.route_id = pr.id
    JOIN stops_b sb ON rb.stop_id = sb.id
    WHERE ra.path_seq < rb.path_seq
  ),

  -- 5. Add schedule info
  segments_with_schedule AS (
    SELECT
      vs.*,
      -- Travel time (assuming 25 km/h)
      ROUND((vs.distance_km / 25.0) * 60)::integer AS travel_min,
      -- Next departure
      (
        CASE
          WHEN s.interval_min > 0 THEN
            EXTRACT(HOUR FROM s.work_start_time)::integer * 60 +
            EXTRACT(MINUTE FROM s.work_start_time)::integer +
            (CEIL(GREATEST(0, v_current_minutes - (EXTRACT(HOUR FROM s.work_start_time)::integer * 60 + EXTRACT(MINUTE FROM s.work_start_time)::integer))::numeric / s.interval_min) * s.interval_min)
          ELSE NULL
        END
      )::integer AS next_departure_min
    FROM valid_segments vs
    LEFT JOIN schedules s ON s.route_id = vs.route_id
    WHERE vs.distance_km > 0
      AND s.interval_min > 0
      AND s.work_start_time IS NOT NULL
  )

  -- 6. Format result
  SELECT
    jsonb_build_object(
      'totalTimeMin', sws.travel_min,
      'totalDistanceKm', sws.distance_km,
      'transferCount', 0,
      'segments', jsonb_build_array(
        jsonb_build_object(
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
        )
      )
    ) AS route_option
  FROM segments_with_schedule sws
  WHERE sws.next_departure_min IS NOT NULL
  ORDER BY sws.travel_min
  LIMIT p_max_results;
END;
$$;

GRANT EXECUTE ON FUNCTION guest_api.plan_route(numeric, numeric, numeric, numeric, numeric, integer, integer)
TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role, ct_admin_role;
