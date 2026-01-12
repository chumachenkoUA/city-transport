-- 0001_setup_roles_and_schemas.sql

-- 1. Create Migrator Role (Skipped because handled by bootstrap)
-- DO $$
--     BEGIN
--         IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_migrator') THEN
--             CREATE ROLE ct_migrator LOGIN PASSWORD 'CHANGE_ME';
--         END IF;
--     END $$;
-- ALTER ROLE ct_migrator CREATEROLE; -- Cannot run as self

-- 1.1 Grant Database Privileges to Migrator
-- DO $$
--     BEGIN
--         EXECUTE format('GRANT CONNECT, CREATE, TEMPORARY ON DATABASE %I TO ct_migrator', current_database());
--     END $$;

-- 2. Create Group Roles (Skipped because handled by bootstrap)
-- DO $$
--     DECLARE
--         role_name text;
--     BEGIN
--         FOREACH role_name IN ARRAY ARRAY[
--             'ct_admin_role',
--             'ct_accountant_role',
--             'ct_dispatcher_role',
--             'ct_controller_role',
--             'ct_driver_role',
--             'ct_passenger_role',
--             'ct_guest_role',
--             'ct_manager_role',
--             'ct_municipality_role'
--             ]
--             LOOP
--                 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
--                     EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
--                 END IF;
--                 -- Grant roles to migrator with ADMIN OPTION
--                 -- EXECUTE format('GRANT %I TO ct_migrator WITH ADMIN OPTION', role_name);
--             END LOOP;
--     END $$;

-- 3. Create API Schemas and 'drizzle' schema
CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION ct_migrator;
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

-- Ensure ct_migrator owns all API schemas explicitly
ALTER SCHEMA drizzle OWNER TO ct_migrator;
ALTER SCHEMA auth OWNER TO ct_migrator;
ALTER SCHEMA guest_api OWNER TO ct_migrator;
ALTER SCHEMA driver_api OWNER TO ct_migrator;
ALTER SCHEMA manager_api OWNER TO ct_migrator;
ALTER SCHEMA passenger_api OWNER TO ct_migrator;
ALTER SCHEMA controller_api OWNER TO ct_migrator;
ALTER SCHEMA dispatcher_api OWNER TO ct_migrator;
ALTER SCHEMA municipality_api OWNER TO ct_migrator;
ALTER SCHEMA accountant_api OWNER TO ct_migrator;
ALTER SCHEMA admin_api OWNER TO ct_migrator;

-- Important: change ownership of the drizzle migrations table if it exists
DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'drizzle' AND tablename = '__drizzle_migrations') THEN
            EXECUTE 'ALTER TABLE drizzle.__drizzle_migrations OWNER TO ct_migrator';
        END IF;
    END $$;

-- 4. Setup Public Tables Ownership
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

-- 4.1. Public Schema Ownership
ALTER SCHEMA public OWNER TO ct_migrator;

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