-- 0006_fix_guest_api_functions.sql

-- 1. Correct the View with explicit type casts to float8 for PostGIS
CREATE OR REPLACE VIEW guest_api.v_route_geometries AS
WITH RECURSIVE ordered_points AS (
    SELECT
        rp.route_id,
        rp.id,
        rp.lon::float8 as lon,
        rp.lat::float8 as lat,
        1 AS sort_order
    FROM public.route_points rp
    WHERE rp.prev_route_point_id IS NULL

    UNION ALL

    SELECT
        next_p.route_id,
        next_p.id,
        next_p.lon::float8 as lon,
        next_p.lat::float8 as lat,
        op.sort_order + 1
    FROM public.route_points next_p
    JOIN ordered_points op ON next_p.prev_route_point_id = op.id
)
SELECT
    r.id AS route_id,
    r.number,
    tt.name AS transport_type,
    r.direction,
    ST_AsGeoJSON(
        ST_MakeLine(
            ST_SetSRID(ST_MakePoint(op.lon, op.lat), 4326)
            ORDER BY op.sort_order
        )
    )::jsonb AS geometry
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id
JOIN ordered_points op ON op.route_id = r.id
WHERE r.is_active = true
GROUP BY r.id, r.number, tt.name, r.direction;

-- 2. Add the missing find_nearby_stops function
CREATE OR REPLACE FUNCTION guest_api.find_nearby_stops(
  p_lon numeric,
  p_lat numeric,
  p_radius_m numeric,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  name text,
  lon numeric,
  lat numeric,
  distance_m double precision
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.lon,
    s.lat,
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

-- 3. Grant execute on function
GRANT EXECUTE ON FUNCTION guest_api.find_nearby_stops(numeric, numeric, numeric, integer) TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;

-- 4. Fix stop geometries view as well
CREATE OR REPLACE VIEW guest_api.v_stop_geometries AS
SELECT
    s.id,
    s.name,
    ST_AsGeoJSON(ST_SetSRID(ST_MakePoint(s.lon::float8, s.lat::float8), 4326))::jsonb AS geometry
FROM public.stops s;
