CREATE SCHEMA IF NOT EXISTS auth;

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
SET search_path = public
AS $$
DECLARE
  new_user_id BIGINT;
BEGIN
  IF p_login IS NULL OR length(trim(p_login)) = 0 THEN
    RAISE EXCEPTION 'Login is required';
  END IF;

  IF p_password IS NULL OR length(trim(p_password)) = 0 THEN
    RAISE EXCEPTION 'Password is required';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE login = p_login) THEN
    RAISE EXCEPTION 'Login already exists';
  END IF;

  IF EXISTS (SELECT 1 FROM users WHERE email = p_email) THEN
    RAISE EXCEPTION 'Email already exists';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
    RAISE EXCEPTION 'Role already exists';
  END IF;

  EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);
  EXECUTE format('GRANT ct_passenger_role TO %I', p_login);

  BEGIN
    INSERT INTO users (login, email, phone, full_name)
    VALUES (p_login, p_email, p_phone, p_full_name)
    RETURNING id INTO new_user_id;
  EXCEPTION WHEN others THEN
    EXECUTE format('DROP ROLE IF EXISTS %I', p_login);
    RAISE;
  END;

  RETURN new_user_id;
END;
$$;
