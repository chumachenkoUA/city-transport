-- City Transport bootstrap (run as postgres/superuser).
-- Update passwords/logins below before running.

-- -------------------------
-- 1) Migrator role
-- -------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_migrator') THEN
    CREATE ROLE ct_migrator LOGIN PASSWORD 'CHANGE_ME';
  END IF;
END $$;

ALTER ROLE ct_migrator CREATEROLE;

DO $$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('ALTER DATABASE %I OWNER TO ct_migrator', db_name);
END $$;

ALTER SCHEMA public OWNER TO ct_migrator;
GRANT USAGE, CREATE ON SCHEMA public TO ct_migrator;

CREATE SCHEMA IF NOT EXISTS drizzle AUTHORIZATION ct_migrator;
ALTER SCHEMA drizzle OWNER TO ct_migrator;
GRANT USAGE, CREATE ON SCHEMA drizzle TO ct_migrator;

ALTER TABLE IF EXISTS drizzle.__drizzle_migrations OWNER TO ct_migrator;
ALTER SEQUENCE IF EXISTS drizzle.__drizzle_migrations_id_seq OWNER TO ct_migrator;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA drizzle TO ct_migrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA drizzle TO ct_migrator;

CREATE EXTENSION IF NOT EXISTS postgis;

-- Ensure ct_migrator owns existing objects (needed for ALTERs in migrations)
DO $$
DECLARE
  obj record;
BEGIN
  FOR obj IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO ct_migrator', obj.schemaname, obj.tablename);
  END LOOP;

  FOR obj IN
    SELECT schemaname, sequencename
    FROM pg_sequences
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER SEQUENCE %I.%I OWNER TO ct_migrator', obj.schemaname, obj.sequencename);
  END LOOP;

  FOR obj IN
    SELECT schemaname, viewname
    FROM pg_views
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER VIEW %I.%I OWNER TO ct_migrator', obj.schemaname, obj.viewname);
  END LOOP;
END $$;

-- -------------------------
-- 2) Group roles (NOLOGIN)
-- -------------------------
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
    'ct_municipality_role'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
  END LOOP;
END $$;

-- -------------------------
-- 3) Login roles (examples)
-- -------------------------
-- Passengers (login = users.login)
DO $$
DECLARE
  login_name text;
BEGIN
  FOREACH login_name IN ARRAY ARRAY['pupkin', 'ivanova', 'bondar', 'shevchenko']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = login_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', login_name, 'CHANGE_ME');
    END IF;
  END LOOP;
END $$;

GRANT ct_passenger_role TO pupkin;
GRANT ct_passenger_role TO ivanova;
GRANT ct_passenger_role TO bondar;
GRANT ct_passenger_role TO shevchenko;

-- Drivers (login = drivers.login)
DO $$
DECLARE
  login_name text;
BEGIN
  FOREACH login_name IN ARRAY ARRAY['driver1', 'driver2', 'driver3']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = login_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', login_name, 'CHANGE_ME');
    END IF;
  END LOOP;
END $$;

GRANT ct_driver_role TO driver1;
GRANT ct_driver_role TO driver2;
GRANT ct_driver_role TO driver3;

-- Staff logins (replace with real logins)
DO $$
DECLARE
  login_name text;
BEGIN
  FOREACH login_name IN ARRAY ARRAY[
    'ct_admin',
    'ct_accountant',
    'ct_dispatcher',
    'ct_controller',
    'ct_municipality'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = login_name) THEN
      EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', login_name, 'CHANGE_ME');
    END IF;
  END LOOP;
END $$;

GRANT ct_admin_role TO ct_admin;
GRANT ct_accountant_role TO ct_accountant;
GRANT ct_dispatcher_role TO ct_dispatcher;
GRANT ct_controller_role TO ct_controller;
GRANT ct_municipality_role TO ct_municipality;

-- -------------------------
-- 4) auth_admin (registration function owner)
-- -------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'auth_admin') THEN
    CREATE ROLE auth_admin NOLOGIN;
  END IF;
END $$;

ALTER ROLE auth_admin CREATEROLE;

DO $$
BEGIN
  IF to_regrole('ct_passenger_role') IS NOT NULL THEN
    EXECUTE 'GRANT ct_passenger_role TO auth_admin WITH ADMIN OPTION';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT, INSERT ON public.users TO auth_admin';
  END IF;
  IF to_regclass('public.users_id_seq') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.users_id_seq TO auth_admin';
  END IF;
END $$;

DO $$
BEGIN
  IF to_regnamespace('auth') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE ON SCHEMA auth TO auth_admin';
  END IF;
  IF to_regproc('auth.register_passenger(text,text,text,text,text)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION auth.register_passenger(text,text,text,text,text) OWNER TO auth_admin';
    EXECUTE 'REVOKE ALL ON FUNCTION auth.register_passenger(text,text,text,text,text) FROM PUBLIC';
  END IF;
END $$;

-- Backend role that calls registration (replace if different)
DO $$
DECLARE
  backend_role text := 'kirito';
BEGIN
  IF to_regrole(backend_role) IS NOT NULL THEN
    EXECUTE format('GRANT USAGE ON SCHEMA auth TO %I', backend_role);
    IF to_regproc('auth.register_passenger(text,text,text,text,text)') IS NOT NULL THEN
      EXECUTE format(
        'GRANT EXECUTE ON FUNCTION auth.register_passenger(text,text,text,text,text) TO %I',
        backend_role
      );
    END IF;
  END IF;
END $$;

-- -------------------------
-- 5) Access to API schemas (views/functions)
-- -------------------------
DO $$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO ct_admin_role, ct_accountant_role, ct_dispatcher_role, ct_controller_role, ct_driver_role, ct_passenger_role, ct_guest_role, ct_municipality_role',
    db_name
  );
END $$;

DO $$
DECLARE
  schema_name text;
BEGIN
  FOREACH schema_name IN ARRAY ARRAY[
    'public',
    'auth',
    'guest_api',
    'passenger_api',
    'controller_api',
    'dispatcher_api',
    'municipality_api',
    'accountant_api',
    'admin_api',
    'driver_api'
  ]
  LOOP
    IF to_regnamespace(schema_name) IS NOT NULL THEN
      EXECUTE format(
        'GRANT USAGE ON SCHEMA %I TO ct_admin_role, ct_accountant_role, ct_dispatcher_role, ct_controller_role, ct_driver_role, ct_passenger_role, ct_guest_role, ct_municipality_role',
        schema_name
      );
    END IF;
  END LOOP;
END $$;

-- Remove direct table access (use API views/functions instead)
DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'ct_accountant_role',
    'ct_dispatcher_role',
    'ct_controller_role',
    'ct_driver_role',
    'ct_passenger_role',
    'ct_guest_role',
    'ct_municipality_role'
  ]
  LOOP
    IF to_regrole(role_name) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
      EXECUTE format('REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
    END IF;
  END LOOP;
END $$;

-- Guest API (read-only)
DO $$
BEGIN
  IF to_regnamespace('guest_api') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA guest_api TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role';
  END IF;
END $$;

-- Passenger API
DO $$
BEGIN
  IF to_regnamespace('passenger_api') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA passenger_api TO ct_passenger_role';
  END IF;
END $$;

-- Controller API
DO $$
BEGIN
  IF to_regnamespace('controller_api') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA controller_api TO ct_controller_role';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA controller_api TO ct_controller_role';
  END IF;
END $$;

-- Driver API
DO $$
BEGIN
  IF to_regnamespace('driver_api') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA driver_api TO ct_driver_role';
    EXECUTE 'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA driver_api TO ct_driver_role';
  END IF;
END $$;
