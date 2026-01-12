-- 1. DISPATCHER LOGIC
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule_v2(p_route_number text, p_transport_type text, p_start time, p_end time, p_interval integer)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_route_id bigint; v_id bigint;
BEGIN
    SELECT r.id INTO v_route_id FROM public.routes r JOIN public.transport_types tt ON tt.id = r.transport_type_id WHERE r.number = p_route_number AND tt.name = p_transport_type LIMIT 1;
    IF v_route_id IS NULL THEN RAISE EXCEPTION 'Route not found'; END IF;
    INSERT INTO public.schedules (route_id, work_start_time, work_end_time, interval_min) VALUES (v_route_id, p_start, p_end, p_interval)
    ON CONFLICT (route_id) DO UPDATE SET work_start_time = EXCLUDED.work_start_time, work_end_time = EXCLUDED.work_end_time, interval_min = EXCLUDED.interval_min RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule(p_schedule_id bigint, p_start time DEFAULT NULL, p_end time DEFAULT NULL, p_interval integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
    UPDATE public.schedules
    SET work_start_time = COALESCE(p_start, work_start_time),
        work_end_time = COALESCE(p_end, work_end_time),
        interval_min = COALESCE(p_interval, interval_min)
    WHERE id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION dispatcher_api.assign_driver_v2(p_driver_id bigint, p_fleet_number text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_vehicle_id bigint; BEGIN
    SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_fleet_number;
    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    INSERT INTO public.driver_vehicle_assignments (driver_id, vehicle_id, assigned_at) VALUES (p_driver_id, v_vehicle_id, now());
END; $$;

-- Dispatcher Views
CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_monitoring AS
SELECT v.id, v.fleet_number, r.number as route_number, tt.name as transport_type, v.last_lon, v.last_lat, v.last_recorded_at,
    CASE WHEN v.last_recorded_at > (now() - interval '5 minutes') THEN 'active' ELSE 'inactive' END as status, d.full_name as current_driver_name
FROM public.vehicles v JOIN public.routes r ON r.id = v.route_id JOIN public.transport_types tt ON tt.id = r.transport_type_id LEFT JOIN public.trips t ON t.vehicle_id = v.id AND t.ends_at IS NULL LEFT JOIN public.drivers d ON d.id = t.driver_id;

CREATE OR REPLACE VIEW dispatcher_api.v_schedules_list AS SELECT s.id, r.number as route_number, tt.name as transport_type, s.work_start_time, s.work_end_time, s.interval_min FROM public.schedules s JOIN public.routes r ON r.id = s.route_id JOIN public.transport_types tt ON tt.id = r.transport_type_id;

CREATE OR REPLACE VIEW dispatcher_api.v_active_trips AS
SELECT t.id, r.number as route_number, v.fleet_number, d.full_name, t.starts_at
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.drivers d ON d.id = t.driver_id
WHERE t.ends_at IS NULL;

CREATE OR REPLACE VIEW dispatcher_api.v_drivers_list AS SELECT id, full_name, login, phone, driver_license_number FROM public.drivers;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicles_list AS
SELECT v.id, v.fleet_number, v.route_id, r.number as route_number, v.vehicle_model_id, vm.capacity
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

CREATE OR REPLACE VIEW dispatcher_api.v_assignments_history AS
SELECT dva.id, dva.driver_id, d.full_name as driver_name, d.login as driver_login, d.phone as driver_phone,
       dva.vehicle_id, v.fleet_number, v.route_id, r.number as route_number, r.direction, tt.id as transport_type_id, tt.name as transport_type, dva.assigned_at
FROM public.driver_vehicle_assignments dva
JOIN public.drivers d ON d.id = dva.driver_id
JOIN public.vehicles v ON v.id = dva.vehicle_id
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id;


-- 0023_dispatcher_schedule_updates.sql

-- Add vehicle link to schedules for dispatcher workflows
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS vehicle_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedules_vehicle_id_vehicles_id_fk'
  ) THEN
    ALTER TABLE public.schedules
      ADD CONSTRAINT schedules_vehicle_id_vehicles_id_fk
      FOREIGN KEY (vehicle_id)
      REFERENCES public.vehicles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Dispatcher views with vehicle + direction
DROP VIEW IF EXISTS dispatcher_api.v_schedules_list;
DROP VIEW IF EXISTS dispatcher_api.v_vehicle_monitoring;
CREATE OR REPLACE VIEW dispatcher_api.v_schedules_list AS
SELECT
  s.id,
  s.route_id,
  r.number as route_number,
  r.direction as direction,
  tt.name as transport_type,
  s.work_start_time,
  s.work_end_time,
  s.interval_min,
  s.vehicle_id,
  v.fleet_number
FROM public.schedules s
JOIN public.routes r ON r.id = s.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicles v ON v.id = s.vehicle_id;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_monitoring AS
SELECT
  v.id,
  v.fleet_number,
  v.route_id,
  r.number as route_number,
  r.direction as direction,
  tt.name as transport_type,
  v.last_lon,
  v.last_lat,
  v.last_recorded_at,
  CASE WHEN v.last_recorded_at > (now() - interval '5 minutes')
    THEN 'active'
    ELSE 'inactive'
  END as status,
  d.full_name as current_driver_name
FROM public.vehicles v
JOIN public.routes r ON r.id = v.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.trips t ON t.vehicle_id = v.id AND t.ends_at IS NULL
LEFT JOIN public.drivers d ON d.id = t.driver_id;

-- Guest schedule view now exposes vehicle_id (optional)
DROP VIEW IF EXISTS guest_api.v_schedules;
CREATE OR REPLACE VIEW guest_api.v_schedules AS
SELECT
  route_id,
  work_start_time,
  work_end_time,
  interval_min,
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday,
  valid_from,
  valid_to,
  vehicle_id
FROM public.schedules;

-- Dispatcher functions with vehicle linkage
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule_v3(
  p_route_id bigint,
  p_vehicle_id bigint,
  p_start time,
  p_end time,
  p_interval integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.schedules (route_id, vehicle_id, work_start_time, work_end_time, interval_min)
  VALUES (p_route_id, p_vehicle_id, p_start, p_end, p_interval)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule_v2(
  p_schedule_id bigint,
  p_route_id bigint DEFAULT NULL,
  p_vehicle_id bigint DEFAULT NULL,
  p_start time DEFAULT NULL,
  p_end time DEFAULT NULL,
  p_interval integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.schedules
  SET route_id = COALESCE(p_route_id, route_id),
      vehicle_id = COALESCE(p_vehicle_id, vehicle_id),
      work_start_time = COALESCE(p_start, work_start_time),
      work_end_time = COALESCE(p_end, work_end_time),
      interval_min = COALESCE(p_interval, interval_min)
  WHERE id = p_schedule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule_v3(bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule_v2(bigint, bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_schedules_list TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_vehicle_monitoring TO ct_dispatcher_role;
-- 0027_dispatcher_unify_functions.sql

-- Remove legacy dispatcher functions.
DROP FUNCTION IF EXISTS dispatcher_api.create_schedule_v2(text, text, time, time, integer);
DROP FUNCTION IF EXISTS dispatcher_api.update_schedule(bigint, time, time, integer);
DROP FUNCTION IF EXISTS dispatcher_api.create_schedule_v3(bigint, bigint, time, time, integer);
DROP FUNCTION IF EXISTS dispatcher_api.update_schedule_v2(bigint, bigint, bigint, time, time, integer);

-- Unified dispatcher schedule APIs.
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule(
  p_route_id bigint,
  p_vehicle_id bigint,
  p_start time,
  p_end time,
  p_interval integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.schedules (route_id, vehicle_id, work_start_time, work_end_time, interval_min)
  VALUES (p_route_id, p_vehicle_id, p_start, p_end, p_interval)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule(
  p_schedule_id bigint,
  p_route_id bigint DEFAULT NULL,
  p_vehicle_id bigint DEFAULT NULL,
  p_start time DEFAULT NULL,
  p_end time DEFAULT NULL,
  p_interval integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.schedules
  SET route_id = COALESCE(p_route_id, route_id),
      vehicle_id = COALESCE(p_vehicle_id, vehicle_id),
      work_start_time = COALESCE(p_start, work_start_time),
      work_end_time = COALESCE(p_end, work_end_time),
      interval_min = COALESCE(p_interval, interval_min)
  WHERE id = p_schedule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule(bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule(bigint, bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
-- 0028_dispatcher_validations.sql

CREATE OR REPLACE FUNCTION public.validate_schedule_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_route_active boolean;
  v_vehicle_route_id bigint;
BEGIN
  IF NEW.work_start_time >= NEW.work_end_time THEN
    RAISE EXCEPTION 'work_start_time must be earlier than work_end_time';
  END IF;

  IF NEW.valid_from IS NOT NULL AND NEW.valid_to IS NOT NULL
     AND NEW.valid_from > NEW.valid_to THEN
    RAISE EXCEPTION 'valid_from must be <= valid_to';
  END IF;

  IF NOT (
    NEW.monday OR NEW.tuesday OR NEW.wednesday OR NEW.thursday OR NEW.friday
    OR NEW.saturday OR NEW.sunday
  ) THEN
    RAISE EXCEPTION 'At least one day of week must be enabled';
  END IF;

  SELECT is_active INTO v_route_active
  FROM public.routes
  WHERE id = NEW.route_id;

  IF v_route_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Route % is not active', NEW.route_id;
  END IF;

  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT route_id INTO v_vehicle_route_id
    FROM public.vehicles
    WHERE id = NEW.vehicle_id;

    IF v_vehicle_route_id IS NULL THEN
      RAISE EXCEPTION 'Vehicle % not found', NEW.vehicle_id;
    END IF;

    IF v_vehicle_route_id <> NEW.route_id THEN
      RAISE EXCEPTION 'Vehicle route does not match schedule route';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS schedules_validate_integrity ON public.schedules;
CREATE TRIGGER schedules_validate_integrity
BEFORE INSERT OR UPDATE OF route_id, vehicle_id, work_start_time, work_end_time,
  interval_min, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
  valid_from, valid_to
ON public.schedules
FOR EACH ROW
EXECUTE FUNCTION public.validate_schedule_integrity();

CREATE OR REPLACE FUNCTION public.validate_driver_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.driver_id = NEW.driver_id AND t.ends_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Driver has an active trip';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.trips t
    WHERE t.vehicle_id = NEW.vehicle_id AND t.ends_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Vehicle has an active trip';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS driver_vehicle_assignments_validate ON public.driver_vehicle_assignments;
CREATE TRIGGER driver_vehicle_assignments_validate
BEFORE INSERT
ON public.driver_vehicle_assignments
FOR EACH ROW
EXECUTE FUNCTION public.validate_driver_assignment();
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


-- Grants
GRANT SELECT ON ALL TABLES IN SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dispatcher_api TO ct_dispatcher_role;
