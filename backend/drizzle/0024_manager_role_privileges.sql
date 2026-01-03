-- Manager role: revoke direct public access, keep API-only

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_manager_role') THEN
    REVOKE ALL PRIVILEGES ON SCHEMA public FROM ct_manager_role;
    REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM ct_manager_role;
    REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ct_manager_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regrole('ct_manager_role') IS NOT NULL THEN
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ct_manager_role';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ct_manager_role';
  END IF;
END $$;
