-- 0016_manager_api.sql

-- 1. УПРАВЛІННЯ ВОДІЯМИ (Вимога 1)

CREATE OR REPLACE FUNCTION manager_api.hire_driver(
    p_login text,
    p_password text,
    p_email text,
    p_phone text,
    p_full_name text,
    p_license_number text,
    p_categories jsonb, -- ['B', 'D']
    p_passport_data jsonb -- { "series": "AA", "number": "123456" }
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
DECLARE
    v_driver_id bigint;
BEGIN
    -- 1. Перевірка наявності
    IF EXISTS (SELECT 1 FROM public.drivers WHERE login = p_login) THEN
        RAISE EXCEPTION 'Driver with login % already exists', p_login;
    END IF;

    -- 2. Створення ролі в БД
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);
    END IF;
    EXECUTE format('GRANT ct_driver_role TO %I', p_login);

    -- 3. Запис у таблицю водіїв
    INSERT INTO public.drivers (
        login, email, phone, full_name,
        driver_license_number, license_categories, passport_data
    )
    VALUES (
               p_login, p_email, p_phone, p_full_name,
               p_license_number, p_categories, p_passport_data
           )
    RETURNING id INTO v_driver_id;

    RETURN v_driver_id;
EXCEPTION WHEN others THEN
    -- Якщо щось пішло не так, роль ми не видаляємо автоматично (для безпеки),
    -- але можна додати DROP ROLE якщо треба.
    RAISE;
END;
$$;

-- 2. ДОДАВАННЯ ТРАНСПОРТУ (Вимога 2)

CREATE OR REPLACE FUNCTION manager_api.add_vehicle(
    p_fleet_number text,
    p_transport_type_name text,
    p_route_number text,
    p_capacity integer,
    p_model_name text
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
DECLARE
    v_type_id bigint;
    v_route_id bigint;
    v_model_id integer;
    v_vehicle_id bigint;
BEGIN
    -- 1. Знайти тип транспорту
    SELECT id INTO v_type_id FROM public.transport_types WHERE name = p_transport_type_name;
    IF v_type_id IS NULL THEN RAISE EXCEPTION 'Transport type % not found', p_transport_type_name; END IF;

    -- 2. Знайти маршрут (беремо forward за замовчуванням)
    SELECT id INTO v_route_id FROM public.routes
    WHERE number = p_route_number AND transport_type_id = v_type_id AND direction = 'forward'
    LIMIT 1;
    IF v_route_id IS NULL THEN RAISE EXCEPTION 'Route % for % not found', p_route_number, p_transport_type_name; END IF;

    -- 3. Створити або знайти модель
    INSERT INTO public.vehicle_models (name, type_id, capacity)
    VALUES (p_model_name, v_type_id::integer, p_capacity)
    ON CONFLICT DO NOTHING; -- В схемі немає унікальності по назві моделі, але припустимо

    SELECT id INTO v_model_id FROM public.vehicle_models
    WHERE name = p_model_name AND type_id = v_type_id::integer AND capacity = p_capacity
    LIMIT 1;

    -- 4. Створити транспорт
    INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id)
    VALUES (p_fleet_number, v_model_id, v_route_id)
    RETURNING id INTO v_vehicle_id;

    RETURN v_vehicle_id;
END;
$$;

-- 3. VIEWS

CREATE OR REPLACE VIEW manager_api.v_drivers AS
SELECT id, login, full_name, email, phone, driver_license_number, license_categories
FROM public.drivers;

CREATE OR REPLACE VIEW manager_api.v_vehicles AS
SELECT
    v.id,
    v.fleet_number,
    r.number as route_number,
    tt.name as transport_type,
    vm.name as model_name,
    vm.capacity
FROM public.vehicles v
         JOIN public.routes r ON r.id = v.route_id
         JOIN public.transport_types tt ON tt.id = r.transport_type_id
         JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

-- 4. GRANTS
GRANT EXECUTE ON FUNCTION manager_api.hire_driver(text, text, text, text, text, text, jsonb, jsonb) TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.add_vehicle(text, text, text, integer, text) TO ct_manager_role;
GRANT SELECT ON manager_api.v_drivers TO ct_manager_role;
GRANT SELECT ON manager_api.v_vehicles TO ct_manager_role;
