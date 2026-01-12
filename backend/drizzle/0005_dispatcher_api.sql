-- 0005_dispatcher_api.sql
-- Dispatcher API: Schedule management and vehicle monitoring

-- 1. Add vehicle link to schedules
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS vehicle_id bigint;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'schedules_vehicle_id_vehicles_id_fk'
    ) THEN
        ALTER TABLE public.schedules
            ADD CONSTRAINT schedules_vehicle_id_vehicles_id_fk
            FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. DISPATCHER VIEWS
CREATE OR REPLACE VIEW dispatcher_api.v_schedules_list AS
SELECT s.id, s.route_id, r.number as route_number, r.direction,
       tt.name as transport_type, s.work_start_time, s.work_end_time,
       s.interval_min, s.vehicle_id, v.fleet_number
FROM public.schedules s
JOIN public.routes r ON r.id = s.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicles v ON v.id = s.vehicle_id;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_monitoring AS
SELECT v.id, v.fleet_number, v.route_id, r.number as route_number,
       r.direction, tt.name as transport_type,
       v.last_lon, v.last_lat, v.last_recorded_at,
       CASE WHEN v.last_recorded_at > (now() - interval '5 minutes')
           THEN 'active' ELSE 'inactive' END as status,
       d.full_name as current_driver_name
FROM public.vehicles v
JOIN public.routes r ON r.id = v.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.trips t ON t.vehicle_id = v.id AND t.ends_at IS NULL
LEFT JOIN public.drivers d ON d.id = t.driver_id;

CREATE OR REPLACE VIEW dispatcher_api.v_active_trips AS
SELECT t.id, r.number as route_number, v.fleet_number, d.full_name, t.starts_at
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.drivers d ON d.id = t.driver_id
WHERE t.ends_at IS NULL;

CREATE OR REPLACE VIEW dispatcher_api.v_drivers_list AS
SELECT id, full_name, login, phone, driver_license_number FROM public.drivers;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicles_list AS
SELECT v.id, v.fleet_number, v.route_id, r.number as route_number,
       v.vehicle_model_id, vm.capacity
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

CREATE OR REPLACE VIEW dispatcher_api.v_assignments_history AS
SELECT dva.id, dva.driver_id, d.full_name as driver_name, d.login as driver_login,
       d.phone as driver_phone, dva.vehicle_id, v.fleet_number, v.route_id,
       r.number as route_number, r.direction, tt.id as transport_type_id,
       tt.name as transport_type, dva.assigned_at
FROM public.driver_vehicle_assignments dva
JOIN public.drivers d ON d.id = dva.driver_id
JOIN public.vehicles v ON v.id = dva.vehicle_id
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id;

-- 3. DISPATCHER FUNCTIONS
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule(
    p_route_id bigint, p_vehicle_id bigint,
    p_start time, p_end time, p_interval integer
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.schedules (route_id, vehicle_id, work_start_time, work_end_time, interval_min)
    VALUES (p_route_id, p_vehicle_id, p_start, p_end, p_interval)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule(
    p_schedule_id bigint,
    p_route_id bigint DEFAULT NULL,
    p_vehicle_id bigint DEFAULT NULL,
    p_start time DEFAULT NULL,
    p_end time DEFAULT NULL,
    p_interval integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.schedules
    SET route_id = COALESCE(p_route_id, route_id),
        vehicle_id = COALESCE(p_vehicle_id, vehicle_id),
        work_start_time = COALESCE(p_start, work_start_time),
        work_end_time = COALESCE(p_end, work_end_time),
        interval_min = COALESCE(p_interval, interval_min)
    WHERE id = p_schedule_id;
END;
$$;

CREATE OR REPLACE FUNCTION dispatcher_api.assign_driver_v2(p_driver_id bigint, p_fleet_number text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_vehicle_id bigint;
BEGIN
    SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_fleet_number;
    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    INSERT INTO public.driver_vehicle_assignments (driver_id, vehicle_id, assigned_at)
    VALUES (p_driver_id, v_vehicle_id, now());
END;
$$;

-- 4. Delay Calculation
CREATE OR REPLACE FUNCTION dispatcher_api.calculate_delay(p_trip_id bigint)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_route_id bigint;
    v_vehicle_id bigint;
    v_trip_start timestamp;
    v_vehicle_lon numeric;
    v_vehicle_lat numeric;
    v_distance_km numeric;
    v_planned_at timestamp;
    v_delay_min numeric;
BEGIN
    SELECT t.route_id, t.vehicle_id, t.starts_at
    INTO v_route_id, v_vehicle_id, v_trip_start
    FROM public.trips t WHERE t.id = p_trip_id;

    IF v_route_id IS NULL OR v_vehicle_id IS NULL THEN RETURN NULL; END IF;

    SELECT v.last_lon, v.last_lat INTO v_vehicle_lon, v_vehicle_lat
    FROM public.vehicles v WHERE v.id = v_vehicle_id;

    IF v_vehicle_lon IS NULL OR v_vehicle_lat IS NULL THEN RETURN NULL; END IF;

    WITH RECURSIVE ordered AS (
        SELECT rs.id, rs.route_id, rs.stop_id, rs.prev_route_stop_id,
               rs.next_route_stop_id, rs.distance_to_next_km,
               0::numeric AS distance_from_start
        FROM public.route_stops rs
        WHERE rs.route_id = v_route_id AND rs.prev_route_stop_id IS NULL
        UNION ALL
        SELECT rs.id, rs.route_id, rs.stop_id, rs.prev_route_stop_id,
               rs.next_route_stop_id, rs.distance_to_next_km,
               o.distance_from_start + COALESCE(o.distance_to_next_km, 0)
        FROM public.route_stops rs
        JOIN ordered o ON rs.prev_route_stop_id = o.id
    )
    SELECT o.distance_from_start INTO v_distance_km
    FROM ordered o
    JOIN public.stops s ON s.id = o.stop_id
    ORDER BY ST_DistanceSphere(
        ST_MakePoint(s.lon::double precision, s.lat::double precision),
        ST_MakePoint(v_vehicle_lon::double precision, v_vehicle_lat::double precision)
    )
    LIMIT 1;

    IF v_distance_km IS NULL THEN RETURN NULL; END IF;

    v_planned_at := v_trip_start + (v_distance_km / 25.0) * interval '1 hour';
    v_delay_min := EXTRACT(EPOCH FROM (now() - v_planned_at)) / 60.0;

    RETURN round(v_delay_min)::integer;
END;
$$;

CREATE OR REPLACE VIEW dispatcher_api.v_active_trip_deviations AS
SELECT * FROM (
    SELECT t.id AS trip_id, r.number AS route_number, v.fleet_number,
           d.full_name AS driver_name, t.starts_at,
           dispatcher_api.calculate_delay(t.id) AS delay_minutes
    FROM public.trips t
    JOIN public.routes r ON r.id = t.route_id
    JOIN public.vehicles v ON v.id = t.vehicle_id
    JOIN public.drivers d ON d.id = t.driver_id
    WHERE t.ends_at IS NULL
) deviations
WHERE deviations.delay_minutes > 5;

-- 5. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule(bigint, bigint, time, time, integer) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule(bigint, bigint, bigint, time, time, integer) TO ct_dispatcher_role;
