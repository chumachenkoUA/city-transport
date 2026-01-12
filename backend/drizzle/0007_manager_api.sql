-- 0007_manager_api.sql
-- Manager API: Driver and vehicle management

-- 1. Hire Driver Function
CREATE OR REPLACE FUNCTION manager_api.hire_driver(
    p_login text, p_password text, p_email text, p_phone text,
    p_full_name text, p_license_number text, p_categories jsonb, p_passport_data jsonb
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);
    END IF;
    EXECUTE format('GRANT ct_driver_role TO %I', p_login);

    INSERT INTO public.drivers (login, email, phone, full_name, driver_license_number, license_categories, passport_data)
    VALUES (p_login, p_email, p_phone, p_full_name, p_license_number, p_categories, p_passport_data)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- 2. Add Vehicle Function (using model_id)
CREATE OR REPLACE FUNCTION manager_api.add_vehicle(
    p_fleet_number text,
    p_model_id bigint,
    p_route_number text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_route_id bigint;
    v_type_id integer;
    v_type_name text;
    v_id bigint;
BEGIN
    -- Check model exists and get type
    SELECT vm.type_id, tt.name INTO v_type_id, v_type_name
    FROM public.vehicle_models vm
    JOIN public.transport_types tt ON tt.id = vm.type_id
    WHERE vm.id = p_model_id;

    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'Vehicle model not found';
    END IF;

    -- Find route if provided
    IF p_route_number IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        WHERE r.number = p_route_number AND r.transport_type_id = v_type_id
        LIMIT 1;

        IF v_route_id IS NULL THEN
            RAISE EXCEPTION 'Route "%" not found for transport type "%". Please select a compatible route.', p_route_number, v_type_name;
        END IF;
    ELSE
        RAISE EXCEPTION 'Route number is required';
    END IF;

    INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id)
    VALUES (p_fleet_number, p_model_id, v_route_id)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- 3. Add Vehicle v2 (with route_id directly)
CREATE OR REPLACE FUNCTION manager_api.add_vehicle_v2(
    p_fleet_number text,
    p_model_id bigint,
    p_route_id bigint DEFAULT NULL,
    p_route_number text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_model_type_id integer;
    v_route_id bigint;
    v_vehicle_id bigint;
BEGIN
    SELECT type_id INTO v_model_type_id FROM public.vehicle_models WHERE id = p_model_id;
    IF v_model_type_id IS NULL THEN
        RAISE EXCEPTION 'Vehicle model % not found', p_model_id;
    END IF;

    v_route_id := p_route_id;
    IF v_route_id IS NULL AND p_route_number IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        WHERE r.number = p_route_number AND r.transport_type_id = v_model_type_id
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

-- 4. VIEWS
CREATE OR REPLACE VIEW manager_api.v_drivers AS
SELECT * FROM public.drivers;

CREATE OR REPLACE VIEW manager_api.v_vehicles AS
SELECT v.id, v.fleet_number, r.number as route_number,
       tt.name as transport_type, vm.name as model_name, vm.capacity
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

CREATE OR REPLACE VIEW manager_api.v_vehicle_models AS
SELECT vm.id, vm.name, vm.capacity, vm.type_id, tt.name as transport_type
FROM public.vehicle_models vm
JOIN public.transport_types tt ON tt.id = vm.type_id;

-- 5. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA manager_api TO ct_manager_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA manager_api TO ct_manager_role;
GRANT SELECT ON manager_api.v_vehicle_models TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.add_vehicle_v2(text, bigint, bigint, text) TO ct_manager_role;
