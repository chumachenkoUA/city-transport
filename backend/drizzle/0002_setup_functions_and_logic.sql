-- 0002_setup_functions_and_logic.sql

-- 1. Registration Function
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
  IF EXISTS (SELECT 1 FROM users WHERE login = p_login) THEN RAISE EXCEPTION 'Login exists'; END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN RAISE EXCEPTION 'Role exists'; END IF;

  EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);
  EXECUTE format('GRANT ct_passenger_role TO %I', p_login);

  INSERT INTO users (login, email, phone, full_name, registered_at)
  VALUES (p_login, p_email, p_phone, p_full_name, NOW())
  RETURNING id INTO new_user_id;

  RETURN new_user_id;
EXCEPTION WHEN others THEN
  EXECUTE format('DROP ROLE IF EXISTS %I', p_login);
  RAISE;
END;
$$;
ALTER FUNCTION auth.register_passenger(text, text, text, text, text) OWNER TO ct_migrator;
GRANT EXECUTE ON FUNCTION auth.register_passenger(text, text, text, text, text) TO ct_guest_role;


-- 2. Driver: Cleanup Stale Trips
CREATE OR REPLACE FUNCTION driver_api.cleanup_stale_trips(p_driver_id bigint) 
RETURNS void AS $$
BEGIN
  UPDATE public.trips t
  SET ends_at = COALESCE(
    (SELECT MAX(recorded_at) 
     FROM public.vehicle_gps_logs vgl 
     WHERE vgl.vehicle_id = t.vehicle_id 
       AND vgl.recorded_at >= t.starts_at),
    t.starts_at + interval '1 minute'
  )
  WHERE t.driver_id = p_driver_id
    AND t.ends_at IS NULL
    AND t.starts_at < (now() - interval '12 hours');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog;
REVOKE ALL ON FUNCTION driver_api.cleanup_stale_trips(bigint) FROM PUBLIC;


-- 3. Driver: Start Trip
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
  SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
  IF v_driver_id IS NULL THEN RAISE EXCEPTION 'driver not found'; END IF;

  SELECT v.id, v.route_id INTO v_vehicle_id, v_route_id
  FROM public.vehicles v
  WHERE v.fleet_number = p_fleet_number;

  IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'vehicle % not found', p_fleet_number; END IF;

  IF p_direction = 'reverse' THEN
    SELECT r2.id INTO v_route_id
    FROM public.routes r2
    WHERE r2.number = (SELECT number FROM public.routes WHERE id = v_route_id)
      AND r2.transport_type_id = (SELECT transport_type_id FROM public.routes WHERE id = v_route_id)
      AND r2.direction = 'reverse';
  END IF;

  PERFORM driver_api.cleanup_stale_trips(v_driver_id);

  IF EXISTS (SELECT 1 FROM public.trips WHERE driver_id = v_driver_id AND ends_at IS NULL) THEN
    RAISE EXCEPTION 'You have an active trip started recently. Please finish it first.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.trips WHERE vehicle_id = v_vehicle_id AND ends_at IS NULL) THEN
    RAISE EXCEPTION 'This vehicle is currently on an active trip.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.driver_vehicle_assignments WHERE driver_id = v_driver_id AND vehicle_id = v_vehicle_id) THEN
    RAISE EXCEPTION 'You are not assigned to vehicle %. Contact dispatcher.', p_fleet_number;
  END IF;

  INSERT INTO public.trips (route_id, vehicle_id, driver_id, starts_at, ends_at, passenger_count)
  VALUES (v_route_id, v_vehicle_id, v_driver_id, p_started_at, NULL, 0)
  RETURNING id INTO v_trip_id;

  RETURN v_trip_id;
END;
$$;
GRANT EXECUTE ON FUNCTION driver_api.start_trip(text, timestamp, text) TO ct_driver_role;


-- 4. Driver: Finish Trip
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
  SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
  SELECT id, starts_at INTO v_trip_id, v_started_at
  FROM public.trips
  WHERE driver_id = v_driver_id AND ends_at IS NULL
  ORDER BY starts_at DESC LIMIT 1;

  IF v_trip_id IS NULL THEN RAISE EXCEPTION 'no active trip'; END IF;
  IF p_ended_at <= v_started_at THEN RAISE EXCEPTION 'end time before start time'; END IF;

  UPDATE public.trips SET ends_at = p_ended_at WHERE id = v_trip_id;
  RETURN v_trip_id;
END;
$$;
GRANT EXECUTE ON FUNCTION driver_api.finish_trip(timestamp) TO ct_driver_role;


-- 5. Driver: Update Passengers
CREATE OR REPLACE FUNCTION driver_api.update_passengers(
  p_trip_id bigint,
  p_passenger_count integer
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_driver_id bigint;
BEGIN
  SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
  IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND driver_id = v_driver_id) THEN
    RAISE EXCEPTION 'Unauthorized or trip not found';
  END IF;
  UPDATE public.trips SET passenger_count = p_passenger_count WHERE id = p_trip_id;
END;
$$;
GRANT EXECUTE ON FUNCTION driver_api.update_passengers(bigint, integer) TO ct_driver_role;


-- 6. GPS Logic
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
  SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
  SELECT vehicle_id INTO v_vehicle_id FROM public.trips 
  WHERE driver_id = v_driver_id AND ends_at IS NULL ORDER BY starts_at DESC LIMIT 1;

  IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'no active trip'; END IF;

  INSERT INTO public.vehicle_gps_logs (vehicle_id, lon, lat, recorded_at)
  VALUES (v_vehicle_id, p_lon, p_lat, p_recorded_at);
END;
$$;
GRANT EXECUTE ON FUNCTION driver_api.log_vehicle_gps(numeric, numeric, timestamp) TO ct_driver_role;


-- 7. GPS Trigger
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lon numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lat numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_recorded_at timestamp;

CREATE OR REPLACE FUNCTION public.fn_update_vehicle_location()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.vehicles
  SET last_lon = NEW.lon,
      last_lat = NEW.lat,
      last_recorded_at = NEW.recorded_at
  WHERE id = NEW.vehicle_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_vehicle_location ON public.vehicle_gps_logs;
CREATE TRIGGER trg_update_vehicle_location
AFTER INSERT ON public.vehicle_gps_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_update_vehicle_location();
