-- ============================================================================
-- 0009_controller_api.sql - API для контролерів
-- ============================================================================
-- Цей файл створює API для контролерів (ct_controller_role):
-- - Виписування штрафів пасажирам
-- - Перегляд активних рейсів на транспорті
-- - Перегляд маршрутів та транспорту
--
-- ПІДХІД (ЖОРСТКА ПРИВ'ЯЗКА):
-- - trips НЕ має vehicle_id - транспорт визначається через driver_vehicle_assignments
-- - Для пошуку рейсу по fleet_number - шукаємо через dva.vehicle_id -> dva.driver_id -> trips.driver_id
--
-- ВАЖЛИВО:
-- 1. issued_by = session_user - записує ХТО виписав штраф (аудит)
-- 2. trip_id обов'язковий - штраф НЕ може бути без рейсу
-- 3. search_path = public, pg_catalog - захист від schema poisoning
-- ============================================================================

-- ============================================================================
-- 1. ФУНКЦІЯ ВИПИСУВАННЯ ШТРАФУ
-- ============================================================================
-- Параметри:
--   p_card - номер транспортної картки пасажира
--   p_amt - сума штрафу
--   p_reason - причина штрафу
--   p_fleet - бортовий номер транспорту (опціонально)
--   p_time - час штрафу (за замовчуванням now())
--   p_trip_id - ID рейсу (опціонально, якщо не вказано - шукає активний рейс)
--
-- ЛОГІКА:
-- 1. Знаходить user_id за номером картки
-- 2. Якщо вказано trip_id - використовує його
-- 3. Якщо вказано fleet - шукає активний рейс на цьому транспорті через assignments
-- 4. Якщо trip_id не знайдено - ПОМИЛКА (штраф без рейсу заборонено)
-- 5. Записує issued_by = session_user для аудиту
CREATE OR REPLACE FUNCTION controller_api.issue_fine(
    p_card text,
    p_amt numeric,
    p_reason text,
    p_fleet text DEFAULT NULL,
    p_time timestamp DEFAULT now(),
    p_trip_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_u_id bigint;
    v_t_id bigint;
    v_driver_id bigint;
    v_vehicle_id bigint;
    v_f_id bigint;
BEGIN
    SELECT user_id INTO v_u_id FROM public.transport_cards WHERE card_number = p_card;
    IF v_u_id IS NULL THEN
        RAISE EXCEPTION 'Card % not found', p_card;
    END IF;

    IF p_trip_id IS NOT NULL THEN
        -- Отримуємо trip і driver_id
        SELECT t.id, t.driver_id INTO v_t_id, v_driver_id
        FROM public.trips t WHERE t.id = p_trip_id;

        IF v_t_id IS NULL THEN
            RAISE EXCEPTION 'Trip % not found', p_trip_id;
        END IF;

        -- Якщо вказано fleet - перевіряємо чи співпадає з призначенням водія
        IF p_fleet IS NOT NULL THEN
            SELECT dva.vehicle_id INTO v_vehicle_id
            FROM public.driver_vehicle_assignments dva
            JOIN public.vehicles v ON v.id = dva.vehicle_id
            WHERE dva.driver_id = v_driver_id AND v.fleet_number = p_fleet;

            IF v_vehicle_id IS NULL THEN
                RAISE EXCEPTION 'Trip % does not match vehicle %', p_trip_id, p_fleet;
            END IF;
        END IF;
    ELSE
        IF p_fleet IS NOT NULL THEN
            -- Шукаємо активний рейс (in_progress) через fleet -> assignments -> driver -> trips
            SELECT t.id INTO v_t_id
            FROM public.trips t
            JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
            JOIN public.vehicles v ON v.id = dva.vehicle_id
            WHERE v.fleet_number = p_fleet
              AND t.status = 'in_progress'
            ORDER BY t.actual_starts_at DESC LIMIT 1;
        END IF;
    END IF;

    -- CRITICAL: Require valid trip for fine issuance
    IF v_t_id IS NULL THEN
        RAISE EXCEPTION 'Cannot issue fine without valid trip. Provide trip_id or fleet/time must match an active trip.';
    END IF;

    -- IMPORTANT: Use session_user to record the actual controller who issued the fine
    -- This is critical for audit trail and security
    INSERT INTO public.fines (user_id, amount, reason, status, trip_id, issued_at, issued_by)
    VALUES (v_u_id, p_amt, p_reason, 'Очікує сплати', v_t_id, p_time, session_user)
    RETURNING id INTO v_f_id;

    RETURN v_f_id;
END;
$$;

-- 2. Get Active Trips for a Vehicle (через assignments)
CREATE OR REPLACE FUNCTION controller_api.get_active_trips(
    p_fleet_number text, p_checked_at timestamp DEFAULT now()
)
RETURNS TABLE (
    trip_id bigint, planned_starts_at timestamp, actual_starts_at timestamp,
    route_number text, transport_type text, driver_name text, status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT t.id, t.planned_starts_at, t.actual_starts_at, r.number, tt.name, d.full_name, t.status
    FROM public.trips t
    JOIN public.drivers d ON d.id = t.driver_id
    JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
    JOIN public.vehicles v ON v.id = dva.vehicle_id
    JOIN public.routes r ON r.id = t.route_id
    JOIN public.transport_types tt ON tt.id = r.transport_type_id
    WHERE v.fleet_number = p_fleet_number
      AND t.status = 'in_progress'
    ORDER BY t.actual_starts_at DESC;
END;
$$;

-- 3. VIEWS
CREATE OR REPLACE VIEW controller_api.v_routes AS
SELECT DISTINCT ON (r.number, tt.name)
    r.id, r.number, tt.name as transport_type
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE r.is_active = true
ORDER BY r.number, tt.name, r.id;

CREATE OR REPLACE VIEW controller_api.v_vehicles AS
SELECT v.id, v.fleet_number, r.id as route_id, r.number as route_number,
       tt.name as transport_type, vm.name as model_name
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

-- 4. GRANTS
GRANT SELECT ON controller_api.v_routes TO ct_controller_role;
GRANT SELECT ON controller_api.v_vehicles TO ct_controller_role;
GRANT EXECUTE ON FUNCTION controller_api.get_active_trips(text, timestamp) TO ct_controller_role;
GRANT EXECUTE ON FUNCTION controller_api.issue_fine(text, numeric, text, text, timestamp, bigint) TO ct_controller_role;
