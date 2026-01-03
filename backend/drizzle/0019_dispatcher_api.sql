-- Dispatcher API: views/functions for schedule, assignments, monitoring

CREATE OR REPLACE VIEW dispatcher_api.v_vehicles
WITH (security_barrier = true)
AS
SELECT v.id,
       v.fleet_number,
       v.route_id,
       v.transport_type_id,
       v.capacity
FROM public.vehicles v;

CREATE OR REPLACE VIEW dispatcher_api.v_drivers
WITH (security_barrier = true)
AS
SELECT d.id,
       d.login,
       d.full_name,
       d.email,
       d.phone
FROM public.drivers d;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_gps_latest
WITH (security_barrier = true)
AS
SELECT DISTINCT ON (l.vehicle_id)
       l.vehicle_id,
       l.lon,
       l.lat,
       l.recorded_at
FROM public.vehicle_gps_logs l
ORDER BY l.vehicle_id, l.recorded_at DESC;

CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule(
  p_route_id bigint,
  p_work_start_time time,
  p_work_end_time time,
  p_interval_min integer
) RETURNS TABLE (
  id bigint,
  route_id bigint,
  work_start_time time,
  work_end_time time,
  interval_min integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_interval_min <= 0 THEN
    RAISE EXCEPTION 'interval_min must be greater than 0';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM routes WHERE id = p_route_id) THEN
    RAISE EXCEPTION 'route % not found', p_route_id;
  END IF;

  IF EXISTS (SELECT 1 FROM schedules WHERE route_id = p_route_id) THEN
    RAISE EXCEPTION 'schedule already exists for route %', p_route_id;
  END IF;

  RETURN QUERY
  INSERT INTO schedules (route_id, work_start_time, work_end_time, interval_min)
  VALUES (p_route_id, p_work_start_time, p_work_end_time, p_interval_min)
  RETURNING schedules.id, schedules.route_id, schedules.work_start_time,
            schedules.work_end_time, schedules.interval_min;
END;
$$;

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule(
  p_id bigint,
  p_route_id bigint DEFAULT NULL,
  p_work_start_time time DEFAULT NULL,
  p_work_end_time time DEFAULT NULL,
  p_interval_min integer DEFAULT NULL
) RETURNS TABLE (
  id bigint,
  route_id bigint,
  work_start_time time,
  work_end_time time,
  interval_min integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_interval_min IS NOT NULL AND p_interval_min <= 0 THEN
    RAISE EXCEPTION 'interval_min must be greater than 0';
  END IF;

  RETURN QUERY
  UPDATE schedules
  SET route_id = COALESCE(p_route_id, schedules.route_id),
      work_start_time = COALESCE(p_work_start_time, schedules.work_start_time),
      work_end_time = COALESCE(p_work_end_time, schedules.work_end_time),
      interval_min = COALESCE(p_interval_min, schedules.interval_min)
  WHERE schedules.id = p_id
  RETURNING schedules.id, schedules.route_id, schedules.work_start_time,
            schedules.work_end_time, schedules.interval_min;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'schedule % not found', p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION dispatcher_api.assign_driver(
  p_driver_id bigint,
  p_vehicle_id bigint,
  p_assigned_at timestamp DEFAULT now()
) RETURNS TABLE (
  id bigint,
  driver_id bigint,
  vehicle_id bigint,
  assigned_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM drivers WHERE id = p_driver_id) THEN
    RAISE EXCEPTION 'driver % not found', p_driver_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vehicles WHERE id = p_vehicle_id) THEN
    RAISE EXCEPTION 'vehicle % not found', p_vehicle_id;
  END IF;

  RETURN QUERY
  INSERT INTO driver_vehicle_assignments (driver_id, vehicle_id, assigned_at)
  VALUES (p_driver_id, p_vehicle_id, p_assigned_at)
  RETURNING driver_vehicle_assignments.id,
            driver_vehicle_assignments.driver_id,
            driver_vehicle_assignments.vehicle_id,
            driver_vehicle_assignments.assigned_at;
END;
$$;

REVOKE ALL ON FUNCTION dispatcher_api.create_schedule(
  bigint,
  time,
  time,
  integer
) FROM PUBLIC;

REVOKE ALL ON FUNCTION dispatcher_api.update_schedule(
  bigint,
  bigint,
  time,
  time,
  integer
) FROM PUBLIC;

REVOKE ALL ON FUNCTION dispatcher_api.assign_driver(
  bigint,
  bigint,
  timestamp
) FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('ct_dispatcher_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON dispatcher_api.v_vehicles TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON dispatcher_api.v_drivers TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON dispatcher_api.v_vehicle_gps_latest TO ct_dispatcher_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule(bigint, time, time, integer) TO ct_dispatcher_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule(bigint, bigint, time, time, integer) TO ct_dispatcher_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION dispatcher_api.assign_driver(bigint, bigint, timestamp) TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON guest_api.v_routes TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON guest_api.v_schedules TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON guest_api.v_transport_types TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON guest_api.v_stops TO ct_dispatcher_role';
  END IF;
END $$;
