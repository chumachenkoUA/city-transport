CREATE OR REPLACE FUNCTION manager_api.hire_driver(p_login text, p_password text, p_email text, p_phone text, p_full_name text, p_license_number text, p_categories jsonb, p_passport_data jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id bigint; BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password); END IF;
    EXECUTE format('GRANT ct_driver_role TO %I', p_login);
    INSERT INTO public.drivers (login, email, phone, full_name, driver_license_number, license_categories, passport_data) VALUES (p_login, p_email, p_phone, p_full_name, p_license_number, p_categories, p_passport_data) RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION manager_api.add_vehicle(
    p_fleet_number text,
    p_transport_type text,
    p_route_number text,
    p_capacity integer,
    p_model_name text
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_model_id bigint;
    v_route_id bigint;
    v_id bigint;
BEGIN
    -- Знаходимо або створюємо модель
    SELECT id INTO v_model_id FROM public.vehicle_models WHERE name = p_model_name AND capacity = p_capacity LIMIT 1;
    IF v_model_id IS NULL THEN
        INSERT INTO public.vehicle_models (name, capacity, manufacturer) VALUES (p_model_name, p_capacity, 'Unknown') RETURNING id INTO v_model_id;
    END IF;

    -- Знаходимо маршрут (якщо вказано)
    IF p_route_number IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        JOIN public.transport_types tt ON tt.id = r.transport_type_id
        WHERE r.number = p_route_number AND tt.name = p_transport_type
        LIMIT 1;
    END IF;

    INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id)
    VALUES (p_fleet_number, v_model_id, v_route_id)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW manager_api.v_drivers AS SELECT * FROM public.drivers;

CREATE OR REPLACE VIEW manager_api.v_vehicles AS
SELECT
    v.id,
    v.fleet_number,
    r.number as route_number,
    tt.name as transport_type,
    vm.name as model_name,
    vm.capacity
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

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

-- Grants
GRANT SELECT ON ALL TABLES IN SCHEMA manager_api TO ct_manager_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA manager_api TO ct_manager_role;
GRANT SELECT ON ALL TABLES IN SCHEMA admin_api TO ct_admin_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA admin_api TO ct_admin_role;
