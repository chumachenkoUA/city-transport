-- 0026_driver_trip_gps_validation.sql

CREATE OR REPLACE FUNCTION public.validate_trip_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vehicle_route_id bigint;
  v_vehicle_route_number text;
  v_vehicle_transport_type_id integer;
  v_trip_route_number text;
  v_trip_transport_type_id integer;
BEGIN
  IF NEW.driver_id IS NULL OR NEW.vehicle_id IS NULL OR NEW.route_id IS NULL THEN
    RAISE EXCEPTION 'driver_id, vehicle_id, and route_id are required';
  END IF;

  IF NEW.passenger_count IS NULL OR NEW.passenger_count < 0 THEN
    RAISE EXCEPTION 'passenger_count must be >= 0';
  END IF;

  IF NEW.ends_at IS NOT NULL AND NEW.ends_at < NEW.starts_at THEN
    RAISE EXCEPTION 'ends_at must be >= starts_at';
  END IF;

  IF NEW.ends_at IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.driver_id = NEW.driver_id
        AND t.ends_at IS NULL
        AND (TG_OP <> 'UPDATE' OR t.id <> NEW.id)
    ) THEN
      RAISE EXCEPTION 'Driver already has an active trip';
    END IF;

    IF EXISTS (
      SELECT 1 FROM public.trips t
      WHERE t.vehicle_id = NEW.vehicle_id
        AND t.ends_at IS NULL
        AND (TG_OP <> 'UPDATE' OR t.id <> NEW.id)
    ) THEN
      RAISE EXCEPTION 'Vehicle already has an active trip';
    END IF;
  END IF;

  SELECT r.id, r.number, r.transport_type_id
  INTO v_vehicle_route_id, v_vehicle_route_number, v_vehicle_transport_type_id
  FROM public.vehicles v
  JOIN public.routes r ON r.id = v.route_id
  WHERE v.id = NEW.vehicle_id;

  IF v_vehicle_route_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle % not found', NEW.vehicle_id;
  END IF;

  SELECT r.number, r.transport_type_id
  INTO v_trip_route_number, v_trip_transport_type_id
  FROM public.routes r
  WHERE r.id = NEW.route_id;

  IF v_trip_route_number IS NULL THEN
    RAISE EXCEPTION 'Route % not found', NEW.route_id;
  END IF;

  IF v_trip_transport_type_id <> v_vehicle_transport_type_id THEN
    RAISE EXCEPTION
      'Trip route transport type % does not match vehicle route transport type %',
      v_trip_transport_type_id,
      v_vehicle_transport_type_id;
  END IF;

  IF v_trip_route_number <> v_vehicle_route_number THEN
    RAISE EXCEPTION
      'Trip route number % does not match vehicle route number %',
      v_trip_route_number,
      v_vehicle_route_number;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trips_validate_integrity ON public.trips;
CREATE TRIGGER trips_validate_integrity
BEFORE INSERT OR UPDATE OF driver_id, vehicle_id, route_id, starts_at, ends_at, passenger_count
ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.validate_trip_integrity();

CREATE OR REPLACE FUNCTION public.validate_vehicle_gps_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.lon < -180 OR NEW.lon > 180 OR NEW.lat < -90 OR NEW.lat > 90 THEN
    RAISE EXCEPTION 'GPS координати поза межами';
  END IF;

  IF NEW.recorded_at > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'recorded_at у майбутньому';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicle_gps_logs_validate ON public.vehicle_gps_logs;
CREATE TRIGGER vehicle_gps_logs_validate
BEFORE INSERT
ON public.vehicle_gps_logs
FOR EACH ROW
EXECUTE FUNCTION public.validate_vehicle_gps_log();
