-- 0007_manager_api.sql
-- Manager API: Driver and vehicle management, staff account creation

-- =============================================================================
-- STAFF ACCOUNT CREATION
-- =============================================================================
-- This function allows managers to create system accounts for non-passenger roles.
-- For the "thick database" architecture, staff accounts (dispatcher, controller,
-- accountant, municipality, manager) need to be created somehow after admin removal.
--
-- Design decisions:
-- 1. Manager has authority to create staff accounts (logical business hierarchy)
-- 2. Whitelist of allowed roles prevents privilege escalation
-- 3. Each role gets appropriate DB role grants automatically
-- 4. For coursework: initial staff accounts can also be created in bootstrap/seed
-- =============================================================================

CREATE OR REPLACE FUNCTION manager_api.create_staff_user(
    p_login text,
    p_password text,
    p_role text,
    p_full_name text DEFAULT NULL,
    p_email text DEFAULT NULL,
    p_phone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_allowed_roles text[] := ARRAY['dispatcher', 'controller', 'accountant', 'municipality', 'manager'];
    v_pg_role text;
BEGIN
    -- Validate role is in whitelist
    IF p_role NOT IN (SELECT unnest(v_allowed_roles)) THEN
        RAISE EXCEPTION 'Invalid role: %. Allowed roles: %', p_role, array_to_string(v_allowed_roles, ', ');
    END IF;

    -- Map role to PostgreSQL role name
    v_pg_role := 'ct_' || p_role || '_role';

    -- Check if login already exists
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        RAISE EXCEPTION 'Login % already exists', p_login;
    END IF;

    -- Create the PostgreSQL role with login privileges
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);

    -- Grant the appropriate business role
    EXECUTE format('GRANT %I TO %I', v_pg_role, p_login);

    -- Note: Staff users don't need entries in users/drivers tables
    -- They authenticate directly via their PostgreSQL role
    -- Their login is used as session_user in API functions

    RAISE NOTICE 'Created staff user % with role %', p_login, v_pg_role;
EXCEPTION
    WHEN others THEN
        -- Cleanup if something fails
        EXECUTE format('DROP ROLE IF EXISTS %I', p_login);
        RAISE;
END;
$$;

-- Function to remove staff user (for completeness)
CREATE OR REPLACE FUNCTION manager_api.remove_staff_user(p_login text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Prevent removing certain critical accounts
    IF p_login IN ('ct_migrator', 'postgres') THEN
        RAISE EXCEPTION 'Cannot remove system account: %', p_login;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        RAISE EXCEPTION 'User % not found', p_login;
    END IF;

    EXECUTE format('DROP ROLE IF EXISTS %I', p_login);

    RAISE NOTICE 'Removed staff user %', p_login;
END;
$$;

-- View of staff roles for reference
CREATE OR REPLACE VIEW manager_api.v_staff_roles AS
SELECT unnest(ARRAY['dispatcher', 'controller', 'accountant', 'municipality', 'manager']) AS role_name,
       unnest(ARRAY[
           'Manages schedules and driver assignments',
           'Issues fines and validates tickets',
           'Manages finances, expenses, and salaries',
           'Manages routes, stops, and analyzes data',
           'Manages drivers, vehicles, and staff accounts'
       ]) AS description;

-- =============================================================================
-- DRIVER MANAGEMENT
-- =============================================================================

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
GRANT SELECT ON manager_api.v_staff_roles TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.add_vehicle_v2(text, bigint, bigint, text) TO ct_manager_role;
-- Staff account management
GRANT EXECUTE ON FUNCTION manager_api.create_staff_user(text, text, text, text, text, text) TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.remove_staff_user(text) TO ct_manager_role;
