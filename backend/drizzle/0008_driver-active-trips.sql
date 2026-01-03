-- Active trips: allow ends_at to be NULL until trip is finished.
ALTER TABLE trips
  ALTER COLUMN ends_at DROP NOT NULL;

ALTER TABLE trips
  DROP CONSTRAINT IF EXISTS trips_ends_after_starts_check;

ALTER TABLE trips
  ADD CONSTRAINT trips_ends_after_starts_check
  CHECK (ends_at IS NULL OR ends_at > starts_at);

-- Prevent multiple active trips for the same driver or vehicle.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_trip_per_driver
  ON trips(driver_id)
  WHERE ends_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_trip_per_vehicle
  ON trips(vehicle_id)
  WHERE ends_at IS NULL;

-- Driver API (stored functions)
CREATE SCHEMA IF NOT EXISTS driver_api;

CREATE OR REPLACE FUNCTION driver_api.start_trip(
  p_fleet_number text,
  p_started_at timestamp DEFAULT now(),
  p_direction text DEFAULT 'forward'
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_driver_id bigint;
  v_vehicle_id bigint;
  v_route_id bigint;
  v_trip_id bigint;
BEGIN
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE login = session_user;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver not found for login %', session_user;
  END IF;

  SELECT v.id, r.id
  INTO v_vehicle_id, v_route_id
  FROM vehicles v
  JOIN routes r ON r.id = v.route_id
  WHERE v.fleet_number = p_fleet_number;

  IF v_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'vehicle not found by fleet_number %', p_fleet_number;
  END IF;

  IF p_direction = 'reverse' THEN
    SELECT r2.id INTO v_route_id
    FROM routes r2
    WHERE r2.number = (SELECT number FROM routes WHERE id = v_route_id)
      AND r2.transport_type_id = (SELECT transport_type_id FROM routes WHERE id = v_route_id)
      AND r2.direction = 'reverse';
  END IF;

  IF v_route_id IS NULL THEN
    RAISE EXCEPTION 'route not found for direction %', p_direction;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM driver_vehicle_assignments a
    WHERE a.driver_id = v_driver_id
      AND a.vehicle_id = v_vehicle_id
  ) THEN
    RAISE EXCEPTION 'driver is not assigned to this vehicle';
  END IF;

  IF EXISTS (
    SELECT 1 FROM trips t
    WHERE t.driver_id = v_driver_id
      AND t.ends_at IS NULL
  ) THEN
    RAISE EXCEPTION 'driver already has an active trip';
  END IF;

  IF EXISTS (
    SELECT 1 FROM trips t
    WHERE t.vehicle_id = v_vehicle_id
      AND t.ends_at IS NULL
  ) THEN
    RAISE EXCEPTION 'vehicle already has an active trip';
  END IF;

  INSERT INTO trips (route_id, vehicle_id, driver_id, starts_at, ends_at, passenger_count)
  VALUES (v_route_id, v_vehicle_id, v_driver_id, p_started_at, NULL, 0)
  RETURNING id INTO v_trip_id;

  RETURN v_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION driver_api.finish_trip(
  p_ended_at timestamp DEFAULT now()
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_driver_id bigint;
  v_trip_id bigint;
  v_started_at timestamp;
BEGIN
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE login = session_user;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver not found for login %', session_user;
  END IF;

  SELECT id, starts_at
  INTO v_trip_id, v_started_at
  FROM trips
  WHERE driver_id = v_driver_id
    AND ends_at IS NULL
  ORDER BY starts_at DESC
  LIMIT 1;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'no active trip to finish';
  END IF;

  IF p_ended_at <= v_started_at THEN
    RAISE EXCEPTION 'trip cannot be finished before it starts';
  END IF;

  UPDATE trips
  SET ends_at = p_ended_at
  WHERE id = v_trip_id;

  RETURN v_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION driver_api.log_vehicle_gps(
  p_lon numeric,
  p_lat numeric,
  p_recorded_at timestamp DEFAULT now()
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_driver_id bigint;
  v_vehicle_id bigint;
BEGIN
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE login = session_user;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver not found for login %', session_user;
  END IF;

  SELECT vehicle_id
  INTO v_vehicle_id
  FROM trips
  WHERE driver_id = v_driver_id
    AND ends_at IS NULL
  ORDER BY starts_at DESC
  LIMIT 1;

  IF v_vehicle_id IS NULL THEN
    RAISE EXCEPTION 'no active trip, cannot log gps';
  END IF;

  INSERT INTO vehicle_gps_logs (vehicle_id, lon, lat, recorded_at)
  VALUES (v_vehicle_id, p_lon, p_lat, p_recorded_at);
END;
$$;

REVOKE ALL ON FUNCTION driver_api.start_trip(text, timestamp, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION driver_api.finish_trip(timestamp) FROM PUBLIC;
REVOKE ALL ON FUNCTION driver_api.log_vehicle_gps(numeric, numeric, timestamp) FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('ct_driver_role') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE ON SCHEMA driver_api TO ct_driver_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION driver_api.start_trip(text, timestamp, text) TO ct_driver_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION driver_api.finish_trip(timestamp) TO ct_driver_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION driver_api.log_vehicle_gps(numeric, numeric, timestamp) TO ct_driver_role';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON trips FROM ct_driver_role';
    EXECUTE 'REVOKE INSERT, UPDATE, DELETE ON vehicle_gps_logs FROM ct_driver_role';
  END IF;
END;
$$;
