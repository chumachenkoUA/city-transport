-- 0025_manager_vehicle_validation.sql

-- New vehicle creation API that aligns with the manager UI payload.
CREATE OR REPLACE FUNCTION manager_api.add_vehicle_v2(
  p_fleet_number text,
  p_model_id bigint,
  p_route_id bigint DEFAULT NULL,
  p_route_number text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_model_type_id integer;
  v_route_id bigint;
  v_vehicle_id bigint;
BEGIN
  SELECT type_id INTO v_model_type_id
  FROM public.vehicle_models
  WHERE id = p_model_id;

  IF v_model_type_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle model % not found', p_model_id;
  END IF;

  v_route_id := p_route_id;
  IF v_route_id IS NULL AND p_route_number IS NOT NULL THEN
    SELECT r.id INTO v_route_id
    FROM public.routes r
    WHERE r.number = p_route_number
      AND r.transport_type_id = v_model_type_id
    ORDER BY CASE r.direction WHEN 'forward' THEN 0 ELSE 1 END
    LIMIT 1;
  END IF;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'Route is required';
  END IF;

  INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id)
  VALUES (p_fleet_number, p_model_id, v_route_id)
  RETURNING id INTO v_vehicle_id;

  RETURN v_vehicle_id;
END;
$$;

GRANT EXECUTE ON FUNCTION manager_api.add_vehicle_v2(text, bigint, bigint, text)
  TO ct_manager_role;

-- Validate that vehicle model type matches route transport type and route is active.
CREATE OR REPLACE FUNCTION public.validate_vehicle_route()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_route_transport_type_id integer;
  v_route_active boolean;
  v_model_type_id integer;
BEGIN
  IF NEW.route_id IS NULL THEN
    RAISE EXCEPTION 'route_id is required';
  END IF;

  SELECT transport_type_id, is_active
  INTO v_route_transport_type_id, v_route_active
  FROM public.routes
  WHERE id = NEW.route_id;

  IF v_route_transport_type_id IS NULL THEN
    RAISE EXCEPTION 'Route % not found', NEW.route_id;
  END IF;

  IF v_route_active IS NOT TRUE THEN
    RAISE EXCEPTION 'Route % is not active', NEW.route_id;
  END IF;

  IF NEW.vehicle_model_id IS NULL THEN
    RAISE EXCEPTION 'vehicle_model_id is required';
  END IF;

  SELECT type_id INTO v_model_type_id
  FROM public.vehicle_models
  WHERE id = NEW.vehicle_model_id;

  IF v_model_type_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle model % not found', NEW.vehicle_model_id;
  END IF;

  IF v_model_type_id <> v_route_transport_type_id THEN
    RAISE EXCEPTION
      'Vehicle model type % does not match route transport type %',
      v_model_type_id,
      v_route_transport_type_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicles_validate_route ON public.vehicles;
CREATE TRIGGER vehicles_validate_route
BEFORE INSERT OR UPDATE OF route_id, vehicle_model_id
ON public.vehicles
FOR EACH ROW
EXECUTE FUNCTION public.validate_vehicle_route();
