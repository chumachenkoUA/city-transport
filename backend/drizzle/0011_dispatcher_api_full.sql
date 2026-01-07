-- 0011_dispatcher_api_full.sql

-- 1. КЕРУВАННЯ РОЗКЛАДОМ

-- Оновлена функція створення розкладу (Вимога 1.1)
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule_v2(
    p_route_number text,
    p_transport_type text,
    p_start time,
    p_end time,
    p_interval integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_route_id bigint;
    v_id bigint;
BEGIN
    SELECT r.id INTO v_route_id
    FROM public.routes r
    JOIN public.transport_types tt ON tt.id = r.transport_type_id
    WHERE r.number = p_route_number AND tt.name = p_transport_type
    LIMIT 1;

    IF v_route_id IS NULL THEN RAISE EXCEPTION 'Route not found'; END IF;

    INSERT INTO public.schedules (route_id, work_start_time, work_end_time, interval_min)
    VALUES (v_route_id, p_start, p_end, p_interval)
    ON CONFLICT (route_id) DO UPDATE
    SET work_start_time = EXCLUDED.work_start_time,
        work_end_time = EXCLUDED.work_end_time,
        interval_min = EXCLUDED.interval_min
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

-- Редагування розкладу (Вимога 1.2)
CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule(
    p_schedule_id bigint,
    p_start time DEFAULT NULL,
    p_end time DEFAULT NULL,
    p_interval integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.schedules
    SET work_start_time = COALESCE(p_start, work_start_time),
        work_end_time = COALESCE(p_end, work_end_time),
        interval_min = COALESCE(p_interval, interval_min)
    WHERE id = p_schedule_id;
END;
$$;

-- Перегляд розкладу (Вимога 2)
CREATE OR REPLACE VIEW dispatcher_api.v_schedules_list AS
SELECT 
    s.id,
    r.number as route_number,
    tt.name as transport_type,
    s.work_start_time,
    s.work_end_time,
    s.interval_min
FROM public.schedules s
JOIN public.routes r ON r.id = s.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id;

-- 2. ПРИЗНАЧЕННЯ ВОДІЯ (Вимога 3)

-- Оновлена функція призначення (за ID водія та номером транспорту)
CREATE OR REPLACE FUNCTION dispatcher_api.assign_driver_v2(
    p_driver_id bigint,
    p_fleet_number text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_vehicle_id bigint;
BEGIN
    SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_fleet_number;
    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

    INSERT INTO public.driver_vehicle_assignments (driver_id, vehicle_id, assigned_at)
    VALUES (p_driver_id, v_vehicle_id, now());
END;
$$;

-- View для списку водіїв (щоб знати кого призначати)
-- Виправлено: видалено неіснуюче поле status
CREATE OR REPLACE VIEW dispatcher_api.v_drivers_list AS
SELECT id, full_name, login, phone, driver_license_number
FROM public.drivers;

-- 3. КОНТРОЛЬ (Вимога 4)

-- Моніторинг транспорту (Вимога 4.1)
CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_monitoring AS
SELECT 
    v.id,
    v.fleet_number,
    r.number as route_number,
    tt.name as transport_type,
    v.last_lon,
    v.last_lat,
    v.last_recorded_at,
    CASE 
        WHEN v.last_recorded_at > (now() - interval '5 minutes') THEN 'active'
        ELSE 'inactive'
    END as status,
    d.full_name as current_driver_name
FROM public.vehicles v
JOIN public.routes r ON r.id = v.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.trips t ON t.vehicle_id = v.id AND t.ends_at IS NULL
LEFT JOIN public.drivers d ON d.id = t.driver_id;

-- 4. GRANTS

GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule_v2(text, text, time, time, integer) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule(bigint, time, time, integer) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.assign_driver_v2(bigint, text) TO ct_dispatcher_role;

GRANT SELECT ON dispatcher_api.v_schedules_list TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_vehicle_monitoring TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_drivers_list TO ct_dispatcher_role;