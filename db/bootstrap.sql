-- City Transport Bootstrap
-- Run this script as a SUPERUSER (e.g., 'postgres').
-- It prepares the environment for the 'ct_migrator' to take over.

-- 1. Create the Migrator Role
-- This role will own the database schema and objects.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_migrator') THEN
    CREATE ROLE ct_migrator LOGIN PASSWORD 'password' CREATEROLE;
    -- CREATEROLE is granted so ct_migrator can create/manage user roles (drivers, passengers) via API functions.
  END IF;
END $$;

-- 1b. Create the Guest Login Role
-- This role is used for unauthenticated API requests (connection pool for guests).
-- It inherits permissions from ct_guest_role (created below).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_guest') THEN
    CREATE ROLE ct_guest LOGIN PASSWORD 'guest_secure_password_change_in_prod';
  END IF;
END $$;

-- 2. Create Group Roles (The "Business" Roles)
-- We create them here so we can grant admin options to ct_migrator immediately.
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
    'ct_manager_role',
    'ct_municipality_role'
  ]
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN', role_name);
    END IF;
    
    -- Crucial: Give ct_migrator the right to grant these roles to others
    EXECUTE format('GRANT %I TO ct_migrator WITH ADMIN OPTION', role_name);
  END LOOP;

  -- Grant ct_guest_role to ct_guest login (for guest API access)
  GRANT ct_guest_role TO ct_guest;
END $$;

-- 3. Database Ownership & Extensions
-- We assume the database "city_transport" (or whatever current DB is) already exists.
-- If running in a fresh container, we might be in 'postgres' DB. 
-- The following block attempts to set ownership of the *current* database.

DO $$
DECLARE
  db_name text := current_database();
BEGIN
  -- Install extensions (must be superuser)
  CREATE EXTENSION IF NOT EXISTS postgis;
  CREATE EXTENSION IF NOT EXISTS pgrouting;
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  
  -- Transfer DB ownership to migrator
  EXECUTE format('ALTER DATABASE %I OWNER TO ct_migrator', db_name);
  
  -- Grant usage on public schema to migrator and allow it to create objects
  GRANT ALL ON SCHEMA public TO ct_migrator;
  ALTER SCHEMA public OWNER TO ct_migrator;
END $$;

-- 4. Clean Public Schema (Optional / Dangerous)
-- Ensures migrator starts with a clean slate if re-running on dirty DB.
-- Uncomment if needed:
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- ALTER SCHEMA public OWNER TO ct_migrator;
-- GRANT ALL ON SCHEMA public TO ct_migrator;

-- 5. Revoke Public Access (Security Hardening)
-- Stop random users from seeing things in public by default.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

DO $$
DECLARE
  db_name text := current_database();
BEGIN
  EXECUTE format('REVOKE ALL ON DATABASE %I FROM PUBLIC', db_name);
  
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO
    ct_migrator,
    ct_guest,
    ct_guest_role,
    ct_passenger_role,
    ct_driver_role,
    ct_dispatcher_role,
    ct_controller_role,
    ct_manager_role,
    ct_municipality_role,
    ct_accountant_role', db_name);
END $$;

-- 6. Helper for Local Development (Grant guest role to current dev user if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kirito') THEN
    GRANT ct_guest_role TO kirito;
  END IF;
END $$;
