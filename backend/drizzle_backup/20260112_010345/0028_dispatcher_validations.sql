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
