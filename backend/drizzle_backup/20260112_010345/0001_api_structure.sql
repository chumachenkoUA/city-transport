-- 0001_api_structure.sql
-- 1. Create API Schemas
CREATE SCHEMA IF NOT EXISTS auth AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS guest_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS driver_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS manager_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS passenger_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS controller_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS dispatcher_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS municipality_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS accountant_api AUTHORIZATION ct_migrator;
CREATE SCHEMA IF NOT EXISTS admin_api AUTHORIZATION ct_migrator;

-- 2. Setup Public Tables Ownership (Ensures Migrator can manage objects created in 0000)
DO $$
DECLARE
    obj record;
BEGIN
    FOR obj IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
          AND tablename != 'spatial_ref_sys'
    LOOP
        EXECUTE format('ALTER TABLE %I.%I OWNER TO ct_migrator', obj.schemaname, obj.tablename);
    END LOOP;
END $$;

ALTER SCHEMA public OWNER TO ct_migrator;

-- 3. Grant Usage on Schemas
GRANT USAGE ON SCHEMA public TO ct_admin_role, ct_accountant_role, ct_dispatcher_role, ct_controller_role, ct_driver_role, ct_passenger_role, ct_guest_role, ct_manager_role, ct_municipality_role;
GRANT USAGE ON SCHEMA auth TO ct_guest_role, ct_passenger_role;
GRANT USAGE ON SCHEMA guest_api TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;
GRANT USAGE ON SCHEMA driver_api TO ct_driver_role;
GRANT USAGE ON SCHEMA manager_api TO ct_manager_role;
GRANT USAGE ON SCHEMA passenger_api TO ct_passenger_role;
GRANT USAGE ON SCHEMA controller_api TO ct_controller_role;
GRANT USAGE ON SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT USAGE ON SCHEMA municipality_api TO ct_municipality_role;
GRANT USAGE ON SCHEMA accountant_api TO ct_accountant_role;
GRANT USAGE ON SCHEMA admin_api TO ct_admin_role;

-- 4. Auth registration logic
CREATE OR REPLACE FUNCTION auth.register_passenger(
    p_login TEXT,
    p_password TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_full_name TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    new_user_id BIGINT;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE login = p_login) THEN RAISE EXCEPTION 'Login exists'; END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN RAISE EXCEPTION 'Role exists'; END IF;

    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);
    EXECUTE format('GRANT ct_passenger_role TO %I', p_login);

    INSERT INTO users (login, email, phone, full_name, registered_at)
    VALUES (p_login, p_email, p_phone, p_full_name, NOW())
    RETURNING id INTO new_user_id;

    RETURN new_user_id;
EXCEPTION WHEN others THEN
    EXECUTE format('DROP ROLE IF EXISTS %I', p_login);
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION auth.register_passenger(text, text, text, text, text) TO ct_guest_role;
