-- Revoke direct access to public tables/sequences for app roles.
-- Keep access via *_api schemas (views/functions).

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_guest_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_guest_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_guest_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_guest_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_passenger_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_passenger_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_passenger_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_passenger_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_controller_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_controller_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_controller_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_controller_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_driver_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_driver_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_driver_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_driver_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_dispatcher_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_dispatcher_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_dispatcher_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_dispatcher_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_municipality_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_municipality_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_municipality_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_municipality_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_accountant_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_accountant_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_accountant_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_accountant_role;
  END IF;
END $$;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON TABLES FROM
  ct_guest_role,
  ct_passenger_role,
  ct_controller_role,
  ct_driver_role,
  ct_dispatcher_role,
  ct_municipality_role,
  ct_accountant_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE ALL ON SEQUENCES FROM
  ct_guest_role,
  ct_passenger_role,
  ct_controller_role,
  ct_driver_role,
  ct_dispatcher_role,
  ct_municipality_role,
  ct_accountant_role;
