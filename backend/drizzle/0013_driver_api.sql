-- Driver API: schedule view, route points view, passenger count function

DROP VIEW IF EXISTS driver_api.v_my_schedule;
DROP VIEW IF EXISTS guest_api.v_route_points;

CREATE OR REPLACE VIEW driver_api.v_my_schedule
WITH (security_barrier = true)
AS
SELECT t.id,
       t.starts_at,
       t.ends_at,
       t.route_id,
       r.number AS route_number,
       r.direction,
       r.transport_type_id,
       t.vehicle_id,
       v.fleet_number,
       tt.name AS transport_type
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY t.starts_at;

CREATE OR REPLACE VIEW guest_api.v_route_points AS
SELECT rp.id,
       rp.route_id,
       rp.lon,
       rp.lat,
       rp.prev_route_point_id,
       rp.next_route_point_id
FROM public.route_points rp;

CREATE OR REPLACE FUNCTION driver_api.set_passenger_count(
  p_day date,
  p_passenger_count integer
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_driver_id bigint;
  v_trip_id bigint;
BEGIN
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE login = session_user;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver not found for login %', session_user;
  END IF;

  IF p_passenger_count < 0 THEN
    RAISE EXCEPTION 'passenger_count must be >= 0';
  END IF;

  SELECT id
  INTO v_trip_id
  FROM trips
  WHERE driver_id = v_driver_id
    AND starts_at >= p_day
    AND starts_at < (p_day + 1)
  ORDER BY starts_at DESC
  LIMIT 1;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'no trips found for day %', p_day;
  END IF;

  UPDATE trips
  SET passenger_count = p_passenger_count
  WHERE id = v_trip_id;

  RETURN v_trip_id;
END;
$$;

REVOKE ALL ON FUNCTION driver_api.set_passenger_count(date, integer) FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('ct_driver_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON driver_api.v_my_schedule TO ct_driver_role';
    EXECUTE 'GRANT SELECT ON guest_api.v_route_points TO ct_driver_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION driver_api.set_passenger_count(date, integer) TO ct_driver_role';
  END IF;
  IF to_regrole('ct_guest_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_points TO ct_guest_role';
  END IF;
  IF to_regrole('ct_passenger_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_points TO ct_passenger_role';
  END IF;
  IF to_regrole('ct_dispatcher_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_points TO ct_dispatcher_role';
  END IF;
  IF to_regrole('ct_municipality_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_points TO ct_municipality_role';
  END IF;
END $$;
