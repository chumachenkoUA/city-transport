-- Ensure SECURITY DEFINER functions bypass RLS and rely on internal checks

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

CREATE OR REPLACE FUNCTION driver_api.set_passenger_count(
  p_day date,
  p_passenger_count integer
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_driver_id bigint;
  v_trip_id bigint;
BEGIN
  SELECT id INTO v_driver_id
  FROM drivers
  WHERE login = session_user;

  IF v_driver_id IS NULL THEN
    RAISE EXCEPTION 'driver not found for login %', session_user;
  END IF;

  IF p_passenger_count < 0 THEN
    RAISE EXCEPTION 'passenger_count must be >= 0';
  END IF;

  SELECT id
  INTO v_trip_id
  FROM trips
  WHERE driver_id = v_driver_id
    AND starts_at >= p_day
    AND starts_at < (p_day + 1)
  ORDER BY starts_at DESC
  LIMIT 1;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'no trips found for day %', p_day;
  END IF;

  UPDATE trips
  SET passenger_count = p_passenger_count
  WHERE id = v_trip_id;

  RETURN v_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION controller_api.issue_fine(
  p_card_number text,
  p_amount numeric,
  p_reason text,
  p_status text DEFAULT 'Очікує сплати',
  p_trip_id bigint DEFAULT NULL,
  p_fleet_number text DEFAULT NULL,
  p_route_number text DEFAULT NULL,
  p_checked_at timestamp DEFAULT now(),
  p_issued_at timestamp DEFAULT now()
) RETURNS TABLE (
  id bigint,
  user_id bigint,
  status text,
  amount numeric,
  reason text,
  issued_by text,
  trip_id bigint,
  issued_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id bigint;
  v_trip_id bigint;
  v_checked_at timestamp;
  v_issued_at timestamp;
BEGIN
  SELECT tc.user_id
  INTO v_user_id
  FROM transport_cards tc
  WHERE tc.card_number = p_card_number;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'card % not found', p_card_number;
  END IF;

  v_checked_at := COALESCE(p_checked_at, now());
  v_issued_at := COALESCE(p_issued_at, v_checked_at);

  IF p_trip_id IS NULL THEN
    IF p_fleet_number IS NULL THEN
      RAISE EXCEPTION 'trip_id or fleet_number must be provided';
    END IF;

    SELECT tr.id
    INTO v_trip_id
    FROM trips tr
    JOIN vehicles v ON v.id = tr.vehicle_id
    JOIN routes r ON r.id = tr.route_id
    WHERE v.fleet_number = p_fleet_number
      AND tr.starts_at <= v_checked_at
      AND (tr.ends_at IS NULL OR tr.ends_at >= v_checked_at)
      AND (p_route_number IS NULL OR r.number = p_route_number)
    ORDER BY tr.starts_at DESC
    LIMIT 1;
  ELSE
    v_trip_id := p_trip_id;
  END IF;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'active trip not found for provided criteria';
  END IF;

  RETURN QUERY
  INSERT INTO fines (user_id, status, amount, reason, issued_by, trip_id, issued_at)
  VALUES (
    v_user_id,
    COALESCE(p_status, 'Очікує сплати'),
    p_amount,
    p_reason,
    session_user,
    v_trip_id,
    v_issued_at
  )
  RETURNING id, user_id, status, amount, reason, issued_by, trip_id, issued_at;
END;
$$;
