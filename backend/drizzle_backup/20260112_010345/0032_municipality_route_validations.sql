-- 0032_municipality_route_validations.sql

CREATE OR REPLACE FUNCTION public.validate_route_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.number IS NULL OR btrim(NEW.number) = '' THEN
    RAISE EXCEPTION 'Route number is required';
  END IF;

  IF NEW.direction IS NULL OR NEW.direction NOT IN ('forward', 'reverse') THEN
    RAISE EXCEPTION 'Route direction must be forward or reverse';
  END IF;

  IF NEW.transport_type_id IS NULL THEN
    RAISE EXCEPTION 'transport_type_id is required';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS routes_validate_data ON public.routes;
CREATE TRIGGER routes_validate_data
BEFORE INSERT OR UPDATE OF number, direction, transport_type_id
ON public.routes
FOR EACH ROW
EXECUTE FUNCTION public.validate_route_data();

CREATE OR REPLACE FUNCTION public.validate_route_stop_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.stop_id IS NULL THEN
    RAISE EXCEPTION 'stop_id is required';
  END IF;

  IF NEW.distance_to_next_km IS NOT NULL AND NEW.distance_to_next_km < 0 THEN
    RAISE EXCEPTION 'distance_to_next_km must be >= 0';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS route_stops_validate_data ON public.route_stops;
CREATE TRIGGER route_stops_validate_data
BEFORE INSERT OR UPDATE OF stop_id, distance_to_next_km
ON public.route_stops
FOR EACH ROW
EXECUTE FUNCTION public.validate_route_stop_data();
