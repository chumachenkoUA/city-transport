-- Guarded default privileges: apply only if roles exist

DO $$
DECLARE
  role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'ct_guest_role',
    'ct_passenger_role',
    'ct_controller_role',
    'ct_driver_role',
    'ct_dispatcher_role',
    'ct_municipality_role',
    'ct_accountant_role'
  ]
  LOOP
    IF to_regrole(role_name) IS NOT NULL THEN
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
        role_name
      );
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
        role_name
      );
    END IF;
  END LOOP;
END $$;
