-- 0005_dispatcher_api.sql
-- Dispatcher API: Trip management and vehicle monitoring
--
-- ПІДХІД (ЖОРСТКА ПРИВ'ЯЗКА):
-- - trips НЕ має vehicle_id - транспорт визначається через driver_vehicle_assignments
-- - Диспетчер створює рейс вказуючи тільки driver_id, транспорт береться з призначення
-- - Один водій = один транспорт, зміна транспорту через reassignment

-- 1. Add vehicle link to schedules (legacy support)
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

-- Список запланованих та активних рейсів
-- vehicle_id береться з driver_vehicle_assignments через driver_id
CREATE OR REPLACE VIEW dispatcher_api.v_trips_list AS
SELECT t.id, t.route_id, r.number as route_number, r.direction,
       tt.name as transport_type,
       dva.vehicle_id, v.fleet_number,
       t.driver_id, d.full_name as driver_name, d.login as driver_login,
       t.planned_starts_at, t.planned_ends_at,
       t.actual_starts_at, t.actual_ends_at,
       t.status,
       t.passenger_count,
       -- Затримка в хвилинах (якщо рейс розпочато)
       CASE
           WHEN t.actual_starts_at IS NOT NULL THEN
               EXTRACT(EPOCH FROM (t.actual_starts_at - t.planned_starts_at)) / 60
           ELSE NULL
       END AS start_delay_min
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
JOIN public.drivers d ON d.id = t.driver_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
ORDER BY t.planned_starts_at DESC;

-- Legacy: schedules list (для шаблонного створення)
CREATE OR REPLACE VIEW dispatcher_api.v_schedules_list AS
SELECT s.id, s.route_id, r.number as route_number, r.direction,
       tt.name as transport_type, s.work_start_time, s.work_end_time,
       s.interval_min, s.vehicle_id, v.fleet_number,
       s.monday, s.tuesday, s.wednesday, s.thursday, s.friday, s.saturday, s.sunday,
       CASE EXTRACT(DOW FROM CURRENT_DATE)
           WHEN 0 THEN s.sunday
           WHEN 1 THEN s.monday
           WHEN 2 THEN s.tuesday
           WHEN 3 THEN s.wednesday
           WHEN 4 THEN s.thursday
           WHEN 5 THEN s.friday
           WHEN 6 THEN s.saturday
       END AS is_active_today
FROM public.schedules s
JOIN public.routes r ON r.id = s.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicles v ON v.id = s.vehicle_id;

-- Моніторинг транспорту - тепер шукаємо активний рейс через driver_id
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
LEFT JOIN public.driver_vehicle_assignments dva ON dva.vehicle_id = v.id
LEFT JOIN public.trips t ON t.driver_id = dva.driver_id AND t.status = 'in_progress'
LEFT JOIN public.drivers d ON d.id = t.driver_id;

-- Активні рейси (in_progress)
CREATE OR REPLACE VIEW dispatcher_api.v_active_trips AS
SELECT t.id, r.number as route_number, v.fleet_number, d.full_name,
       t.planned_starts_at, t.actual_starts_at,
       EXTRACT(EPOCH FROM (t.actual_starts_at - t.planned_starts_at)) / 60 AS start_delay_min
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.drivers d ON d.id = t.driver_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
WHERE t.status = 'in_progress';

-- Заплановані рейси (scheduled) на сьогодні
CREATE OR REPLACE VIEW dispatcher_api.v_scheduled_trips_today AS
SELECT t.id, r.number as route_number, r.direction,
       v.fleet_number, d.full_name as driver_name,
       t.planned_starts_at, t.planned_ends_at
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.drivers d ON d.id = t.driver_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
WHERE t.status = 'scheduled'
  AND t.planned_starts_at::date = CURRENT_DATE
ORDER BY t.planned_starts_at;

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

-- ============================================================================
-- ФУНКЦІЇ СТВОРЕННЯ РЕЙСІВ (БЕЗ vehicle_id - береться з assignments)
-- ============================================================================

-- Створити один рейс
-- Транспорт визначається автоматично з driver_vehicle_assignments
CREATE OR REPLACE FUNCTION dispatcher_api.create_trip(
    p_route_id bigint,
    p_driver_id bigint,
    p_planned_starts_at timestamp,
    p_planned_ends_at timestamp DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_trip_id bigint;
BEGIN
    -- Валідація
    IF NOT EXISTS (SELECT 1 FROM public.routes WHERE id = p_route_id) THEN
        RAISE EXCEPTION 'Route % not found', p_route_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.drivers WHERE id = p_driver_id) THEN
        RAISE EXCEPTION 'Driver % not found', p_driver_id;
    END IF;
    -- Перевірка що водій має призначений транспорт
    IF NOT EXISTS (SELECT 1 FROM public.driver_vehicle_assignments WHERE driver_id = p_driver_id) THEN
        RAISE EXCEPTION 'Driver % has no assigned vehicle', p_driver_id;
    END IF;

    INSERT INTO public.trips (
        route_id, driver_id,
        planned_starts_at, planned_ends_at,
        status, passenger_count
    )
    VALUES (
        p_route_id, p_driver_id,
        p_planned_starts_at, p_planned_ends_at,
        'scheduled', 0
    )
    RETURNING id INTO v_trip_id;

    RETURN v_trip_id;
END;
$$;

-- Створити кілька рейсів на день (з інтервалом)
CREATE OR REPLACE FUNCTION dispatcher_api.generate_daily_trips(
    p_route_id bigint,
    p_driver_id bigint,
    p_date date,
    p_start_time time,
    p_end_time time,
    p_interval_min integer,
    p_trip_duration_min integer DEFAULT 60
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_current_time time;
    v_count integer := 0;
    v_planned_starts timestamp;
    v_planned_ends timestamp;
BEGIN
    -- Перевірка що водій має призначений транспорт
    IF NOT EXISTS (SELECT 1 FROM public.driver_vehicle_assignments WHERE driver_id = p_driver_id) THEN
        RAISE EXCEPTION 'Driver % has no assigned vehicle', p_driver_id;
    END IF;

    v_current_time := p_start_time;

    WHILE v_current_time <= p_end_time LOOP
        v_planned_starts := p_date + v_current_time;
        v_planned_ends := v_planned_starts + (p_trip_duration_min * interval '1 minute');

        INSERT INTO public.trips (
            route_id, driver_id,
            planned_starts_at, planned_ends_at,
            status, passenger_count
        )
        VALUES (
            p_route_id, p_driver_id,
            v_planned_starts, v_planned_ends,
            'scheduled', 0
        );

        v_count := v_count + 1;
        v_current_time := v_current_time + (p_interval_min * interval '1 minute');
    END LOOP;

    RETURN v_count;
END;
$$;

-- Скасувати рейс
CREATE OR REPLACE FUNCTION dispatcher_api.cancel_trip(p_trip_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.trips
    SET status = 'cancelled'
    WHERE id = p_trip_id AND status = 'scheduled';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip % not found or not in scheduled status', p_trip_id;
    END IF;
END;
$$;

-- Видалити рейс (тільки scheduled)
CREATE OR REPLACE FUNCTION dispatcher_api.delete_trip(p_trip_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    DELETE FROM public.trips
    WHERE id = p_trip_id AND status = 'scheduled';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip % not found or not in scheduled status', p_trip_id;
    END IF;
END;
$$;

-- ============================================================================
-- LEGACY: Функції для schedules (шаблони)
-- ============================================================================

CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule(
    p_route_id bigint,
    p_vehicle_id bigint,
    p_start time,
    p_end time,
    p_interval integer,
    p_monday boolean DEFAULT true,
    p_tuesday boolean DEFAULT true,
    p_wednesday boolean DEFAULT true,
    p_thursday boolean DEFAULT true,
    p_friday boolean DEFAULT true,
    p_saturday boolean DEFAULT false,
    p_sunday boolean DEFAULT false
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_id bigint;
    v_vehicle_route_id bigint;
BEGIN
    -- Validate: vehicle must belong to the route
    IF p_vehicle_id IS NOT NULL THEN
        SELECT route_id INTO v_vehicle_route_id
        FROM public.vehicles WHERE id = p_vehicle_id;

        IF v_vehicle_route_id IS NULL THEN
            RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id;
        END IF;

        IF v_vehicle_route_id != p_route_id THEN
            RAISE EXCEPTION 'Vehicle % belongs to route %, not route %',
                p_vehicle_id, v_vehicle_route_id, p_route_id;
        END IF;
    END IF;

    -- Validate: end time must be after start time
    IF p_end <= p_start THEN
        RAISE EXCEPTION 'End time (%) must be after start time (%)', p_end, p_start;
    END IF;

    INSERT INTO public.schedules (
        route_id, vehicle_id, work_start_time, work_end_time, interval_min,
        monday, tuesday, wednesday, thursday, friday, saturday, sunday
    )
    VALUES (
        p_route_id, p_vehicle_id, p_start, p_end, p_interval,
        p_monday, p_tuesday, p_wednesday, p_thursday, p_friday, p_saturday, p_sunday
    )
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
    p_interval integer DEFAULT NULL,
    p_monday boolean DEFAULT NULL,
    p_tuesday boolean DEFAULT NULL,
    p_wednesday boolean DEFAULT NULL,
    p_thursday boolean DEFAULT NULL,
    p_friday boolean DEFAULT NULL,
    p_saturday boolean DEFAULT NULL,
    p_sunday boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_current_route_id bigint;
    v_current_start time;
    v_current_end time;
    v_vehicle_route_id bigint;
    v_final_route_id bigint;
    v_final_start time;
    v_final_end time;
BEGIN
    -- Get current schedule values
    SELECT route_id, work_start_time, work_end_time
    INTO v_current_route_id, v_current_start, v_current_end
    FROM public.schedules WHERE id = p_schedule_id;

    IF v_current_route_id IS NULL THEN
        RAISE EXCEPTION 'Schedule % not found', p_schedule_id;
    END IF;

    -- Calculate final values
    v_final_route_id := COALESCE(p_route_id, v_current_route_id);
    v_final_start := COALESCE(p_start, v_current_start);
    v_final_end := COALESCE(p_end, v_current_end);

    -- Validate: vehicle must belong to the route
    IF p_vehicle_id IS NOT NULL THEN
        SELECT route_id INTO v_vehicle_route_id
        FROM public.vehicles WHERE id = p_vehicle_id;

        IF v_vehicle_route_id IS NULL THEN
            RAISE EXCEPTION 'Vehicle % not found', p_vehicle_id;
        END IF;

        IF v_vehicle_route_id != v_final_route_id THEN
            RAISE EXCEPTION 'Vehicle % belongs to route %, not route %',
                p_vehicle_id, v_vehicle_route_id, v_final_route_id;
        END IF;
    END IF;

    -- Validate: end time must be after start time
    IF v_final_end <= v_final_start THEN
        RAISE EXCEPTION 'End time (%) must be after start time (%)', v_final_end, v_final_start;
    END IF;

    UPDATE public.schedules
    SET route_id = v_final_route_id,
        vehicle_id = COALESCE(p_vehicle_id, vehicle_id),
        work_start_time = v_final_start,
        work_end_time = v_final_end,
        interval_min = COALESCE(p_interval, interval_min),
        monday = COALESCE(p_monday, monday),
        tuesday = COALESCE(p_tuesday, tuesday),
        wednesday = COALESCE(p_wednesday, wednesday),
        thursday = COALESCE(p_thursday, thursday),
        friday = COALESCE(p_friday, friday),
        saturday = COALESCE(p_saturday, saturday),
        sunday = COALESCE(p_sunday, sunday)
    WHERE id = p_schedule_id;
END;
$$;

-- Delete schedule function
CREATE OR REPLACE FUNCTION dispatcher_api.delete_schedule(p_schedule_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    DELETE FROM public.schedules WHERE id = p_schedule_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule % not found', p_schedule_id;
    END IF;
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

-- 4. Delay Calculation (спрощена версія - порівнюємо план і факт)
CREATE OR REPLACE FUNCTION dispatcher_api.calculate_delay(p_trip_id bigint)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_planned_starts timestamp;
    v_actual_starts timestamp;
    v_delay_min numeric;
BEGIN
    SELECT t.planned_starts_at, t.actual_starts_at
    INTO v_planned_starts, v_actual_starts
    FROM public.trips t WHERE t.id = p_trip_id;

    IF v_planned_starts IS NULL THEN RETURN NULL; END IF;

    -- Якщо рейс ще не розпочато - порівнюємо з поточним часом
    IF v_actual_starts IS NULL THEN
        v_delay_min := EXTRACT(EPOCH FROM (now() - v_planned_starts)) / 60.0;
    ELSE
        -- Рейс розпочато - порівнюємо факт з планом
        v_delay_min := EXTRACT(EPOCH FROM (v_actual_starts - v_planned_starts)) / 60.0;
    END IF;

    RETURN round(v_delay_min)::integer;
END;
$$;

-- Відхилення від розкладу
CREATE OR REPLACE VIEW dispatcher_api.v_active_trip_deviations AS
SELECT * FROM (
    SELECT t.id AS trip_id, r.number AS route_number, v.fleet_number,
           d.full_name AS driver_name,
           t.planned_starts_at, t.actual_starts_at,
           dispatcher_api.calculate_delay(t.id) AS delay_minutes
    FROM public.trips t
    JOIN public.routes r ON r.id = t.route_id
    JOIN public.drivers d ON d.id = t.driver_id
    LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
    LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
    WHERE t.status IN ('scheduled', 'in_progress')
) deviations
WHERE ABS(deviations.delay_minutes) > 5;

-- ============================================================================
-- 5. DEPARTURE TIMES GENERATION
-- ============================================================================
-- Замінює buildDepartureTimes() який був продубльований в dispatcher та guest сервісах

CREATE OR REPLACE FUNCTION dispatcher_api.get_departure_times(
  p_work_start_time time,
  p_work_end_time time,
  p_interval_min integer
)
RETURNS TABLE (departure_time text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  IF p_interval_min <= 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT public.format_minutes_to_time(
    public.parse_time_to_minutes(p_work_start_time) + (n * p_interval_min)
  )
  FROM generate_series(0,
    ((public.parse_time_to_minutes(p_work_end_time) -
      public.parse_time_to_minutes(p_work_start_time)) / p_interval_min)::int
  ) AS n;
END;
$$;

-- ============================================================================
-- 6. DASHBOARD AGGREGATION
-- ============================================================================
-- Замінює getDashboard() який робив 6 паралельних запитів в одному API виклику

CREATE OR REPLACE FUNCTION dispatcher_api.get_dashboard()
RETURNS TABLE (
  active_trips integer,
  deviations integer,
  schedules_today integer,
  unassigned_drivers integer,
  unassigned_vehicles integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::integer FROM dispatcher_api.v_active_trips),
    (SELECT COUNT(*)::integer FROM dispatcher_api.v_active_trip_deviations),
    (SELECT COUNT(*)::integer FROM dispatcher_api.v_schedules_list),
    (SELECT COUNT(*)::integer FROM dispatcher_api.v_drivers_list d
      WHERE NOT EXISTS (
        SELECT 1 FROM public.driver_vehicle_assignments dva
        WHERE dva.driver_id = d.id
      )
    ),
    (SELECT COUNT(*)::integer FROM dispatcher_api.v_vehicles_list v
      WHERE NOT EXISTS (
        SELECT 1 FROM public.driver_vehicle_assignments dva
        WHERE dva.vehicle_id = v.id
      )
    );
END;
$$;

-- 7. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dispatcher_api TO ct_dispatcher_role;

-- Trip functions (NEW - без vehicle_id)
GRANT EXECUTE ON FUNCTION dispatcher_api.create_trip(bigint, bigint, timestamp, timestamp) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.generate_daily_trips(bigint, bigint, date, time, time, integer, integer) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.cancel_trip(bigint) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.delete_trip(bigint) TO ct_dispatcher_role;

-- Schedule functions (LEGACY)
GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule(
    bigint, bigint, time, time, integer,
    boolean, boolean, boolean, boolean, boolean, boolean, boolean
) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule(
    bigint, bigint, bigint, time, time, integer,
    boolean, boolean, boolean, boolean, boolean, boolean, boolean
) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.delete_schedule(bigint) TO ct_dispatcher_role;

-- New utility functions
GRANT EXECUTE ON FUNCTION dispatcher_api.get_departure_times(time, time, integer) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.get_dashboard() TO ct_dispatcher_role;
