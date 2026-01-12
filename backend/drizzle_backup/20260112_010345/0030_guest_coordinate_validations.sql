-- 0030_guest_coordinate_validations.sql

CREATE OR REPLACE FUNCTION public.validate_stop_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.lon < -180 OR NEW.lon > 180 OR NEW.lat < -90 OR NEW.lat > 90 THEN
    RAISE EXCEPTION 'Stop coordinates are out of range';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS stops_validate_coordinates ON public.stops;
CREATE TRIGGER stops_validate_coordinates
BEFORE INSERT OR UPDATE OF lon, lat
ON public.stops
FOR EACH ROW
EXECUTE FUNCTION public.validate_stop_coordinates();

CREATE OR REPLACE FUNCTION public.validate_route_point_coordinates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.lon < -180 OR NEW.lon > 180 OR NEW.lat < -90 OR NEW.lat > 90 THEN
    RAISE EXCEPTION 'Route point coordinates are out of range';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS route_points_validate_coordinates ON public.route_points;
CREATE TRIGGER route_points_validate_coordinates
BEFORE INSERT OR UPDATE OF lon, lat
ON public.route_points
FOR EACH ROW
EXECUTE FUNCTION public.validate_route_point_coordinates();
