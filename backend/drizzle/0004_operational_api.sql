-- ============================================================================
-- 0004_operational_api.sql - Операційний API для водіїв
-- ============================================================================
-- Цей файл створює API для водіїв (ct_driver_role):
-- - Початок та завершення рейсу
-- - GPS логування транспорту
-- - Перегляд своїх запланованих рейсів
--
-- ПІДХІД (ЖОРСТКА ПРИВ'ЯЗКА):
-- - trips НЕ має vehicle_id - транспорт визначається через driver_vehicle_assignments
-- - Водій бачить свої scheduled рейси
-- - Водій стартує рейс → status = 'in_progress', actual_starts_at = now()
-- - Водій завершує рейс → status = 'completed', actual_ends_at = now()
-- ============================================================================

-- ============================================================================
-- 1. ЛОГІКА ВОДІЯ - Функції для управління рейсами
-- ============================================================================

-- Helper: cleanup stale trips (auto-complete trips older than 12 hours)
CREATE OR REPLACE FUNCTION driver_api.cleanup_stale_trips(p_driver_id bigint)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_vehicle_id bigint;
BEGIN
    -- Отримуємо vehicle_id з assignments
    SELECT dva.vehicle_id INTO v_vehicle_id
    FROM public.driver_vehicle_assignments dva
    WHERE dva.driver_id = p_driver_id
    LIMIT 1;

    UPDATE public.trips t
    SET actual_ends_at = COALESCE(
        (SELECT MAX(recorded_at) FROM public.vehicle_gps_logs vgl
         WHERE vgl.vehicle_id = v_vehicle_id AND vgl.recorded_at >= t.actual_starts_at),
        t.actual_starts_at + interval '1 minute'
    ),
    status = 'completed'
    WHERE t.driver_id = p_driver_id
      AND t.status = 'in_progress'
      AND t.actual_starts_at < (now() - interval '12 hours');
END;
$$;

-- Start Trip: запускає існуючий scheduled рейс АБО найближчий scheduled рейс
CREATE OR REPLACE FUNCTION driver_api.start_trip(
    p_trip_id bigint DEFAULT NULL,
    p_started_at timestamp DEFAULT now()
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_driver_id bigint;
    v_trip_id bigint;
BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
    IF v_driver_id IS NULL THEN RAISE EXCEPTION 'driver not found'; END IF;

    -- Cleanup stale trips
    PERFORM driver_api.cleanup_stale_trips(v_driver_id);

    -- Перевірка чи є активний рейс
    IF EXISTS (SELECT 1 FROM public.trips WHERE driver_id = v_driver_id AND status = 'in_progress') THEN
        RAISE EXCEPTION 'Active trip exists. Finish it first.';
    END IF;

    -- Якщо передано trip_id - стартуємо конкретний рейс
    IF p_trip_id IS NOT NULL THEN
        SELECT id INTO v_trip_id FROM public.trips
        WHERE id = p_trip_id AND driver_id = v_driver_id AND status = 'scheduled';

        IF v_trip_id IS NULL THEN
            RAISE EXCEPTION 'Trip % not found or not scheduled for you', p_trip_id;
        END IF;
    ELSE
        -- Знаходимо найближчий scheduled рейс для цього водія
        SELECT id INTO v_trip_id FROM public.trips
        WHERE driver_id = v_driver_id
          AND status = 'scheduled'
          AND planned_starts_at <= now() + interval '30 minutes'
        ORDER BY planned_starts_at
        LIMIT 1;

        IF v_trip_id IS NULL THEN
            RAISE EXCEPTION 'No scheduled trips found. Ask dispatcher to create one.';
        END IF;
    END IF;

    -- Перевірка не потрібна - один водій = один транспорт,
    -- і partial unique index на driver_id вже гарантує унікальність

    -- Стартуємо рейс
    UPDATE public.trips
    SET status = 'in_progress',
        actual_starts_at = p_started_at
    WHERE id = v_trip_id;

    RETURN v_trip_id;
END;
$$;

-- Finish Trip: завершує активний рейс
CREATE OR REPLACE FUNCTION driver_api.finish_trip(p_ended_at timestamp DEFAULT now())
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_driver_id bigint; v_trip_id bigint;
BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
    IF v_driver_id IS NULL THEN RAISE EXCEPTION 'driver not found'; END IF;

    SELECT id INTO v_trip_id FROM public.trips
    WHERE driver_id = v_driver_id AND status = 'in_progress'
    ORDER BY actual_starts_at DESC LIMIT 1;

    IF v_trip_id IS NULL THEN RAISE EXCEPTION 'no active trip'; END IF;

    UPDATE public.trips
    SET status = 'completed',
        actual_ends_at = p_ended_at
    WHERE id = v_trip_id;

    RETURN v_trip_id;
END;
$$;

-- Update Passengers
CREATE OR REPLACE FUNCTION driver_api.update_passengers(p_trip_id bigint, p_passenger_count integer)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_driver_id bigint;
BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id AND driver_id = v_driver_id) THEN
        RAISE EXCEPTION 'Unauthorized or trip not found';
    END IF;
    UPDATE public.trips SET passenger_count = p_passenger_count WHERE id = p_trip_id;
END;
$$;

-- Log Vehicle GPS - отримуємо vehicle_id з assignments
CREATE OR REPLACE FUNCTION driver_api.log_vehicle_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp DEFAULT now())
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_driver_id bigint; v_vehicle_id bigint;
BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;

    -- Перевірка чи є активний рейс
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE driver_id = v_driver_id AND status = 'in_progress') THEN
        RAISE EXCEPTION 'no active trip';
    END IF;

    -- Отримуємо vehicle_id з driver_vehicle_assignments
    SELECT dva.vehicle_id INTO v_vehicle_id
    FROM public.driver_vehicle_assignments dva
    WHERE dva.driver_id = v_driver_id
    LIMIT 1;

    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'no vehicle assigned'; END IF;

    INSERT INTO public.vehicle_gps_logs (vehicle_id, lon, lat, recorded_at)
    VALUES (v_vehicle_id, p_lon, p_lat, p_recorded_at);
END;
$$;

-- GPS Location Cache Columns
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lon numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_lat numeric;
ALTER TABLE public.vehicles ADD COLUMN IF NOT EXISTS last_recorded_at timestamp;

-- GPS Trigger for live location
CREATE OR REPLACE FUNCTION public.fn_update_vehicle_location()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.vehicles
    SET last_lon = NEW.lon, last_lat = NEW.lat, last_recorded_at = NEW.recorded_at
    WHERE id = NEW.vehicle_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_vehicle_location ON public.vehicle_gps_logs;
CREATE TRIGGER trg_update_vehicle_location
AFTER INSERT ON public.vehicle_gps_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_update_vehicle_location();

-- 2. DRIVER VIEWS
CREATE OR REPLACE VIEW driver_api.v_profile WITH (security_barrier = true) AS
SELECT id, login, full_name, email, phone, driver_license_number, license_categories
FROM public.drivers WHERE login = session_user;

-- Усі рейси водія (історія + заплановані)
-- vehicle_id береться з driver_vehicle_assignments
CREATE OR REPLACE VIEW driver_api.v_my_trips WITH (security_barrier = true) AS
SELECT t.id, t.route_id, r.number AS route_number, r.direction,
       tt.name AS transport_type, dva.vehicle_id, v.fleet_number,
       t.planned_starts_at, t.planned_ends_at,
       t.actual_starts_at, t.actual_ends_at,
       t.status, t.passenger_count,
       -- Затримка старту (хв)
       CASE WHEN t.actual_starts_at IS NOT NULL THEN
           EXTRACT(EPOCH FROM (t.actual_starts_at - t.planned_starts_at)) / 60
       ELSE NULL END AS start_delay_min
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY t.planned_starts_at DESC;

-- Заплановані рейси на сьогодні
CREATE OR REPLACE VIEW driver_api.v_my_scheduled_trips WITH (security_barrier = true) AS
SELECT t.id, t.route_id, r.number AS route_number, r.direction,
       tt.name AS transport_type, dva.vehicle_id, v.fleet_number,
       t.planned_starts_at, t.planned_ends_at, t.status
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
  AND t.status = 'scheduled'
  AND t.planned_starts_at::date = CURRENT_DATE
ORDER BY t.planned_starts_at;

-- Активний рейс (in_progress)
CREATE OR REPLACE VIEW driver_api.v_my_active_trip WITH (security_barrier = true) AS
SELECT t.id, t.route_id, r.number AS route_number, r.direction,
       tt.name AS transport_type, dva.vehicle_id, v.fleet_number,
       t.planned_starts_at, t.actual_starts_at, t.passenger_count,
       EXTRACT(EPOCH FROM (t.actual_starts_at - t.planned_starts_at)) / 60 AS start_delay_min
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
  AND t.status = 'in_progress'
LIMIT 1;

-- Legacy: v_my_schedule (для сумісності)
CREATE OR REPLACE VIEW driver_api.v_my_schedule WITH (security_barrier = true) AS
SELECT t.id,
       t.planned_starts_at AS starts_at,
       t.actual_ends_at AS ends_at,
       t.passenger_count, t.route_id,
       r.number AS route_number, r.direction, r.transport_type_id,
       tt.name AS transport_type, dva.vehicle_id, v.fleet_number
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY t.planned_starts_at;

-- Driver vehicle assignments view (legacy)
CREATE OR REPLACE VIEW driver_api.v_my_assignments WITH (security_barrier = true) AS
SELECT
    dva.id AS assignment_id,
    dva.assigned_at,
    v.id AS vehicle_id,
    v.fleet_number,
    vm.name AS vehicle_model,
    vm.capacity AS vehicle_capacity,
    r.id AS route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type
FROM public.driver_vehicle_assignments dva
JOIN public.drivers d ON d.id = dva.driver_id
JOIN public.vehicles v ON v.id = dva.vehicle_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY dva.assigned_at DESC;

-- View for today's schedule (тепер показує заплановані рейси)
CREATE OR REPLACE VIEW driver_api.v_my_today_schedule WITH (security_barrier = true) AS
SELECT
    t.id AS trip_id,
    v.fleet_number,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    t.planned_starts_at,
    t.planned_ends_at,
    t.status,
    true AS is_working_today
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
JOIN public.routes r ON r.id = t.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
  AND t.planned_starts_at::date = CURRENT_DATE
  AND t.status IN ('scheduled', 'in_progress')
ORDER BY t.planned_starts_at;

-- 3. CONTROLLER VIEWS (basic)
-- ============================================================================
-- v_card_details - Інформація про картку для контролера
-- ============================================================================
-- Показує: номер картки, баланс, ПІБ власника, останню поїздку
-- Остання поїздка: дата, маршрут, тип транспорту
CREATE OR REPLACE VIEW controller_api.v_card_details AS
SELECT tc.id, tc.card_number, tc.balance, tc.user_id,
    u.full_name as user_full_name,
    (SELECT t.purchased_at FROM public.tickets t WHERE t.card_id = tc.id ORDER BY t.purchased_at DESC LIMIT 1) as last_usage_at,
    (SELECT r.number FROM public.tickets t JOIN public.trips tr ON tr.id = t.trip_id JOIN public.routes r ON r.id = tr.route_id WHERE t.card_id = tc.id ORDER BY t.purchased_at DESC LIMIT 1) as last_route_number,
    (SELECT tt.name FROM public.tickets t JOIN public.trips tr ON tr.id = t.trip_id JOIN public.routes r ON r.id = tr.route_id JOIN public.transport_types tt ON tt.id = r.transport_type_id WHERE t.card_id = tc.id ORDER BY t.purchased_at DESC LIMIT 1) as last_transport_type
FROM public.transport_cards tc
JOIN public.users u ON u.id = tc.user_id;

-- 4. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA driver_api TO ct_driver_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA driver_api TO ct_driver_role;
GRANT SELECT ON ALL TABLES IN SCHEMA controller_api TO ct_controller_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA controller_api TO ct_controller_role;
