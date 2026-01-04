-- 0001_setup_roles_and_schemas.sql

-- 1. Create Migrator Role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_migrator') THEN
    CREATE ROLE ct_migrator LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END $$;
ALTER ROLE ct_migrator CREATEROLE;

-- 2. Create Group Roles
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'ct_admin_role',
    'ct_accountant_role',
    'ct_dispatcher_role',
    'ct_controller_role',
    'ct_driver_role',
    'ct_passenger_role',
    'ct_guest_role',
    'ct_manager_role',
    'ct_municipality_role'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
    -- Important: give migrator ADMIN OPTION so it can grant these roles to users in functions
    EXECUTE format('GRANT %I TO ct_migrator WITH ADMIN OPTION', role_name);
  END LOOP;
END $$;

-- 3. Create API Schemas
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

-- 4. Setup Ownership (Crucial for SECURITY DEFINER functions)
DO $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO ct_migrator', obj.schemaname, obj.tablename);
  END LOOP;
END $$;

-- 5. Grant Usage on Public Schema
GRANT USAGE ON SCHEMA public TO ct_admin_role, ct_accountant_role, ct_dispatcher_role, ct_controller_role, ct_driver_role, ct_passenger_role, ct_guest_role, ct_manager_role, ct_municipality_role;

-- 6. Grant API Schema usages
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

-- 7. Revoke Public Access (Secure by default)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;
