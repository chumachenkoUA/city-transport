-- Manager API: views and functions for hiring drivers and adding vehicles

CREATE SCHEMA IF NOT EXISTS manager_api;

CREATE OR REPLACE VIEW manager_api.v_drivers AS
SELECT d.id,
       d.login,
       d.full_name,
       d.email,
       d.phone,
       d.driver_license_number,
       d.license_categories,
       d.passport_data
FROM public.drivers d;

CREATE OR REPLACE VIEW manager_api.v_vehicles AS
SELECT v.id,
       v.fleet_number,
       v.capacity,
       v.transport_type_id,
       tt.name AS transport_type,
       v.route_id,
       r.number AS route_number,
       r.direction
FROM public.vehicles v
JOIN public.transport_types tt ON tt.id = v.transport_type_id
JOIN public.routes r ON r.id = v.route_id;

CREATE OR REPLACE VIEW manager_api.v_routes AS
SELECT r.id,
       r.number,
       r.direction,
       r.transport_type_id,
       tt.name AS transport_type
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id;

CREATE OR REPLACE VIEW manager_api.v_transport_types AS
SELECT tt.id, tt.name
FROM public.transport_types tt;

CREATE OR REPLACE FUNCTION manager_api.create_driver(
  p_login text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_driver_license_number text,
  p_passport_data jsonb,
  p_license_categories jsonb DEFAULT '[]'::jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO drivers (
    login,
    full_name,
    email,
    phone,
    driver_license_number,
    passport_data,
    license_categories
  )
  VALUES (
    p_login,
    p_full_name,
    p_email,
    p_phone,
    p_driver_license_number,
    p_passport_data,
    COALESCE(p_license_categories, '[]'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION manager_api.create_vehicle(
  p_fleet_number text,
  p_transport_type_id bigint,
  p_capacity integer,
  p_route_id bigint DEFAULT NULL,
  p_route_number text DEFAULT NULL,
  p_direction text DEFAULT 'forward'
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_route_id bigint;
  v_id bigint;
BEGIN
  IF p_capacity <= 0 THEN
    RAISE EXCEPTION 'capacity must be > 0';
  END IF;

  v_route_id := p_route_id;

  IF v_route_id IS NULL THEN
    IF p_route_number IS NULL THEN
      RAISE EXCEPTION 'route_id or route_number is required';
    END IF;

    SELECT r.id
    INTO v_route_id
    FROM routes r
    WHERE r.number = p_route_number
      AND r.transport_type_id = p_transport_type_id
      AND r.direction = p_direction
    LIMIT 1;
  END IF;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'route not found';
  END IF;

  INSERT INTO vehicles (
    fleet_number,
    transport_type_id,
    capacity,
    route_id
  )
  VALUES (
    p_fleet_number,
    p_transport_type_id,
    p_capacity,
    v_route_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION manager_api.create_driver(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  jsonb
) FROM PUBLIC;

REVOKE ALL ON FUNCTION manager_api.create_vehicle(
  text,
  bigint,
  integer,
  bigint,
  text,
  text
) FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('ct_manager_role') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE ON SCHEMA manager_api TO ct_manager_role';
    EXECUTE 'GRANT SELECT ON manager_api.v_drivers TO ct_manager_role';
    EXECUTE 'GRANT SELECT ON manager_api.v_vehicles TO ct_manager_role';
    EXECUTE 'GRANT SELECT ON manager_api.v_routes TO ct_manager_role';
    EXECUTE 'GRANT SELECT ON manager_api.v_transport_types TO ct_manager_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION manager_api.create_driver(text, text, text, text, text, jsonb, jsonb) TO ct_manager_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION manager_api.create_vehicle(text, bigint, integer, bigint, text, text) TO ct_manager_role';
  END IF;
END $$;
