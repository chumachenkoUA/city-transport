-- 0002_setup_business_logic.sql

-- =============================================
-- AUTH & REGISTRATION
-- =============================================

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


-- =============================================
-- DRIVER LOGIC
-- =============================================

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

-- GPS Trigger logic
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lon numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lat numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_recorded_at timestamp;

CREATE OR REPLACE FUNCTION public.fn_update_vehicle_location()
    RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.vehicles
    SET last_lon = NEW.lon, last_lat = NEW.lat, last_recorded_at = NEW.recorded_at
    WHERE id = NEW.vehicle_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_vehicle_location ON public.vehicle_gps_logs;
CREATE TRIGGER trg_update_vehicle_location
    AFTER INSERT ON public.vehicle_gps_logs
    FOR EACH ROW EXECUTE FUNCTION public.fn_update_vehicle_location();


-- =============================================
-- MUNICIPALITY LOGIC
-- =============================================

CREATE OR REPLACE FUNCTION municipality_api.create_stop(p_name text, p_lon numeric, p_lat numeric)
    RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id bigint; BEGIN INSERT INTO public.stops (name, lon, lat) VALUES (p_name, p_lon, p_lat) RETURNING id INTO v_id; RETURN v_id; END; $$;

CREATE OR REPLACE FUNCTION municipality_api.update_stop(p_id bigint, p_name text, p_lon numeric, p_lat numeric)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN UPDATE public.stops SET name = p_name, lon = p_lon, lat = p_lat WHERE id = p_id; END; $$;

CREATE OR REPLACE FUNCTION municipality_api.create_route_full(
    p_number text, p_transport_type_id integer, p_direction text, p_stops_json jsonb, p_points_json jsonb
) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_route_id bigint; v_stop record; v_point record; v_prev_stop_id bigint := NULL; v_new_stop_id bigint; v_prev_point_id bigint := NULL;
BEGIN
    INSERT INTO public.routes (number, transport_type_id, direction, is_active) VALUES (p_number, p_transport_type_id, p_direction, true) RETURNING id INTO v_route_id;
    FOR v_stop IN SELECT * FROM jsonb_to_recordset(p_stops_json) AS x(stop_id bigint, name text, lon numeric, lat numeric, distance_to_next_km numeric) LOOP
            IF v_stop.stop_id IS NOT NULL THEN v_new_stop_id := v_stop.stop_id; ELSE INSERT INTO public.stops (name, lon, lat) VALUES (v_stop.name, v_stop.lon, v_stop.lat) RETURNING id INTO v_new_stop_id; END IF;
            INSERT INTO public.route_stops (route_id, stop_id, prev_route_stop_id, distance_to_next_km) VALUES (v_route_id, v_new_stop_id, v_prev_stop_id, v_stop.distance_to_next_km) RETURNING id INTO v_prev_stop_id;
        END LOOP;
    FOR v_point IN SELECT * FROM jsonb_to_recordset(p_points_json) AS x(lon numeric, lat numeric) LOOP
            INSERT INTO public.route_points (route_id, lon, lat, prev_route_point_id) VALUES (v_route_id, v_point.lon, v_point.lat, v_prev_point_id) RETURNING id INTO v_prev_point_id;
        END LOOP;
    RETURN v_route_id;
END; $$;


-- =============================================
-- DISPATCHER & CONTROLLER & PASSENGER
-- =============================================

CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule(p_route_id bigint, p_start time, p_end time, p_int integer)
    RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id bigint; BEGIN INSERT INTO public.schedules (route_id, work_start_time, work_end_time, interval_min) VALUES (p_route_id, p_start, p_end, p_int) RETURNING id INTO v_id; RETURN v_id; END; $$;

CREATE OR REPLACE FUNCTION dispatcher_api.assign_driver(p_login text, p_fleet text)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_d_id bigint; v_v_id bigint; BEGIN
    SELECT id INTO v_d_id FROM public.drivers WHERE login = p_login;
    SELECT id INTO v_v_id FROM public.vehicles WHERE fleet_number = p_fleet;
    INSERT INTO public.driver_vehicle_assignments (driver_id, vehicle_id, assigned_at) VALUES (v_d_id, v_v_id, now());
END; $$;

CREATE OR REPLACE FUNCTION controller_api.issue_fine(p_card text, p_amt numeric, p_reason text, p_fleet text DEFAULT NULL)
    RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_u_id bigint; v_t_id bigint; v_f_id bigint; BEGIN
    SELECT user_id INTO v_u_id FROM public.transport_cards WHERE card_number = p_card;
    IF p_fleet IS NOT NULL THEN SELECT t.id INTO v_t_id FROM public.trips t JOIN public.vehicles v ON v.id = t.vehicle_id WHERE v.fleet_number = p_fleet AND t.ends_at IS NULL ORDER BY t.starts_at DESC LIMIT 1; END IF;
    INSERT INTO public.fines (user_id, amount, reason, status, trip_id, issued_at) VALUES (v_u_id, p_amt, p_reason, 'Очікує сплати', v_t_id, now()) RETURNING id INTO v_f_id; RETURN v_f_id;
END; $$;

CREATE OR REPLACE FUNCTION passenger_api.buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric)
    RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_bal numeric; v_tid bigint; v_uid bigint; BEGIN
    SELECT user_id, balance INTO v_uid, v_bal FROM public.transport_cards WHERE id = p_card_id;
    IF (SELECT id FROM public.users WHERE login = session_user) != v_uid THEN RAISE EXCEPTION 'Not your card'; END IF;
    IF v_bal < p_price THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    UPDATE public.transport_cards SET balance = balance - p_price WHERE id = p_card_id;
    INSERT INTO public.tickets (card_id, trip_id, price, purchased_at) VALUES (p_card_id, p_trip_id, p_price, now()) RETURNING id INTO v_tid; RETURN v_tid;
END; $$;

CREATE OR REPLACE FUNCTION passenger_api.top_up_card(p_card text, p_amt numeric)
    RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cid bigint; BEGIN
    SELECT id INTO v_cid FROM public.transport_cards WHERE card_number = p_card;
    UPDATE public.transport_cards SET balance = balance + p_amt WHERE id = v_cid;
    INSERT INTO public.card_top_ups (card_id, amount, topped_up_at) VALUES (v_cid, p_amt, now());
END; $$;


-- =============================================
-- GRANTS
-- =============================================

GRANT EXECUTE ON FUNCTION driver_api.start_trip(text, timestamp, text) TO ct_driver_role;
GRANT EXECUTE ON FUNCTION driver_api.finish_trip(timestamp) TO ct_driver_role;
GRANT EXECUTE ON FUNCTION driver_api.update_passengers(bigint, integer) TO ct_driver_role;
GRANT EXECUTE ON FUNCTION driver_api.log_vehicle_gps(numeric, numeric, timestamp) TO ct_driver_role;

GRANT EXECUTE ON FUNCTION municipality_api.create_stop(text, numeric, numeric) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.update_stop(bigint, text, numeric, numeric) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.create_route_full(text, integer, text, jsonb, jsonb) TO ct_municipality_role;

GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule(bigint, time, time, integer) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.assign_driver(text, text) TO ct_dispatcher_role;

GRANT EXECUTE ON FUNCTION controller_api.issue_fine(text, numeric, text, text) TO ct_controller_role;

GRANT EXECUTE ON FUNCTION passenger_api.buy_ticket(bigint, bigint, numeric) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.top_up_card(text, numeric) TO ct_passenger_role;
