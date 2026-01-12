-- 0004_operational_api.sql

-- 1. DRIVER LOGIC
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION driver_api.start_trip(
    p_fleet_number text,
    p_started_at timestamp DEFAULT now(),
    p_direction text DEFAULT 'forward'
) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
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
    FROM public.vehicles v WHERE v.fleet_number = p_fleet_number;
    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'vehicle % not found', p_fleet_number; END IF;

    IF p_direction = 'reverse' THEN
        SELECT r2.id INTO v_route_id FROM public.routes r2
        WHERE r2.number = (SELECT number FROM public.routes WHERE id = v_route_id)
          AND r2.transport_type_id = (SELECT transport_type_id FROM public.routes WHERE id = v_route_id)
          AND r2.direction = 'reverse';
    END IF;

    PERFORM driver_api.cleanup_stale_trips(v_driver_id);
    IF EXISTS (SELECT 1 FROM public.trips WHERE driver_id = v_driver_id AND ends_at IS NULL) THEN
        RAISE EXCEPTION 'Active trip exists. Finish it first.';
    END IF;
    IF EXISTS (SELECT 1 FROM public.trips WHERE vehicle_id = v_vehicle_id AND ends_at IS NULL) THEN
        RAISE EXCEPTION 'Vehicle is already on a trip.';
    END IF;

    INSERT INTO public.trips (route_id, vehicle_id, driver_id, starts_at, ends_at, passenger_count)
    VALUES (v_route_id, v_vehicle_id, v_driver_id, p_started_at, NULL, 0)
    RETURNING id INTO v_trip_id;
    RETURN v_trip_id;
END;
$$;

CREATE OR REPLACE FUNCTION driver_api.finish_trip(p_ended_at timestamp DEFAULT now()) 
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_driver_id bigint; v_trip_id bigint; v_started_at timestamp;
BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
    SELECT id, starts_at INTO v_trip_id, v_started_at FROM public.trips
    WHERE driver_id = v_driver_id AND ends_at IS NULL ORDER BY starts_at DESC LIMIT 1;
    IF v_trip_id IS NULL THEN RAISE EXCEPTION 'no active trip'; END IF;
    UPDATE public.trips SET ends_at = p_ended_at WHERE id = v_trip_id;
    RETURN v_trip_id;
END; $$;

CREATE OR REPLACE FUNCTION driver_api.update_passengers(p_trip_id bigint, p_passenger_count integer) 
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_driver_id bigint; BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND driver_id = v_driver_id) THEN
        RAISE EXCEPTION 'Unauthorized or trip not found';
    END IF;
    UPDATE public.trips SET passenger_count = p_passenger_count WHERE id = p_trip_id;
END; $$;

CREATE OR REPLACE FUNCTION driver_api.log_vehicle_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp DEFAULT now()) 
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_driver_id bigint; v_vehicle_id bigint; BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
    SELECT vehicle_id INTO v_vehicle_id FROM public.trips WHERE driver_id = v_driver_id AND ends_at IS NULL ORDER BY starts_at DESC LIMIT 1;
    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'no active trip'; END IF;
    INSERT INTO public.vehicle_gps_logs (vehicle_id, lon, lat, recorded_at) VALUES (v_vehicle_id, p_lon, p_lat, p_recorded_at);
END; $$;

-- GPS Trigger
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lon numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lat numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_recorded_at timestamp;

CREATE OR REPLACE FUNCTION public.fn_update_vehicle_location() RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.vehicles SET last_lon = NEW.lon, last_lat = NEW.lat, last_recorded_at = NEW.recorded_at WHERE id = NEW.vehicle_id;
    RETURN NEW;
END; $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_vehicle_location ON public.vehicle_gps_logs;
CREATE TRIGGER trg_update_vehicle_location AFTER INSERT ON public.vehicle_gps_logs FOR EACH ROW EXECUTE FUNCTION public.fn_update_vehicle_location();

-- 2. OPERATIONAL VIEWS
CREATE OR REPLACE VIEW driver_api.v_profile AS SELECT id, login, full_name, email, phone, driver_license_number, license_categories FROM public.drivers WHERE login = session_user;

CREATE OR REPLACE VIEW driver_api.v_my_schedule WITH (security_barrier = true) AS
SELECT t.id, t.starts_at, t.ends_at, t.passenger_count, t.route_id, r.number AS route_number, r.direction, r.transport_type_id, tt.name AS transport_type, t.vehicle_id, v.fleet_number
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY t.starts_at;

-- CONTROLLER LOGIC
CREATE OR REPLACE FUNCTION controller_api.issue_fine(
    p_card text,
    p_amt numeric,
    p_reason text,
    p_fleet text DEFAULT NULL,
    p_time timestamp DEFAULT now()
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_u_id bigint; v_t_id bigint; v_f_id bigint; BEGIN
    SELECT user_id INTO v_u_id FROM public.transport_cards WHERE card_number = p_card;
    IF p_fleet IS NOT NULL THEN
        SELECT t.id INTO v_t_id FROM public.trips t JOIN public.vehicles v ON v.id = t.vehicle_id
        WHERE v.fleet_number = p_fleet AND t.ends_at IS NULL ORDER BY t.starts_at DESC LIMIT 1;
    END IF;
    INSERT INTO public.fines (user_id, amount, reason, status, trip_id, issued_at)
    VALUES (v_u_id, p_amt, p_reason, 'Очікує сплати', v_t_id, p_time) RETURNING id INTO v_f_id;
    RETURN v_f_id;
END; $$;

CREATE OR REPLACE VIEW controller_api.v_card_details AS
SELECT tc.id, tc.card_number, tc.balance, tc.user_id,
    (SELECT t.purchased_at FROM public.tickets t WHERE t.card_id = tc.id ORDER BY t.purchased_at DESC LIMIT 1) as last_usage_at,
    (SELECT r.number FROM public.tickets t JOIN public.trips tr ON tr.id = t.trip_id JOIN public.routes r ON r.id = tr.route_id WHERE t.card_id = tc.id ORDER BY t.purchased_at DESC LIMIT 1) as last_route_number,
    (SELECT tt.name FROM public.tickets t JOIN public.trips tr ON tr.id = t.trip_id JOIN public.routes r ON r.id = tr.route_id JOIN public.transport_types tt ON tt.id = r.transport_type_id WHERE t.card_id = tc.id ORDER BY t.purchased_at DESC LIMIT 1) as last_transport_type
FROM public.transport_cards tc;

-- GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA driver_api TO ct_driver_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA driver_api TO ct_driver_role;
GRANT SELECT ON ALL TABLES IN SCHEMA controller_api TO ct_controller_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA controller_api TO ct_controller_role;
