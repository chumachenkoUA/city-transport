-- Guest API: helper functions for public queries

CREATE OR REPLACE FUNCTION guest_api.find_nearby_stops(
  p_lon numeric,
  p_lat numeric,
  p_radius_m integer DEFAULT 500,
  p_limit integer DEFAULT 10
) RETURNS TABLE (
  id bigint,
  name text,
  lon numeric,
  lat numeric,
  distance_m numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT s.id,
         s.name,
         s.lon,
         s.lat,
         ST_Distance(
           s.geom,
           ST_SetSRID(ST_MakePoint(p_lon::double precision, p_lat::double precision), 4326)::geography
         ) AS distance_m
  FROM public.stops s
  WHERE ST_DWithin(
    s.geom,
    ST_SetSRID(ST_MakePoint(p_lon::double precision, p_lat::double precision), 4326)::geography,
    p_radius_m
  )
  ORDER BY distance_m
  LIMIT p_limit;
$$;

REVOKE ALL ON FUNCTION guest_api.find_nearby_stops(numeric, numeric, integer, integer) FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('ct_guest_role') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE ON SCHEMA guest_api TO ct_guest_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION guest_api.find_nearby_stops(numeric, numeric, integer, integer) TO ct_guest_role';
  END IF;
  IF to_regrole('ct_passenger_role') IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION guest_api.find_nearby_stops(numeric, numeric, integer, integer) TO ct_passenger_role';
  END IF;
END $$;
