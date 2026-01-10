-- Grant ct_guest_role to the development user 'kirito' to allow access to guest API
-- This is needed because the backend connects as 'kirito' for guest requests

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kirito') THEN
    GRANT ct_guest_role TO kirito;
  END IF;
END $$;
