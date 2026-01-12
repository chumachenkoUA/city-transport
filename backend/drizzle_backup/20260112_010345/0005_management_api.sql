-- 0005_management_api.sql

-- 1. DISPATCHER LOGIC
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule_v2(p_route_number text, p_transport_type text, p_start time, p_end time, p_interval integer)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_route_id bigint; v_id bigint;
BEGIN
    SELECT r.id INTO v_route_id FROM public.routes r JOIN public.transport_types tt ON tt.id = r.transport_type_id WHERE r.number = p_route_number AND tt.name = p_transport_type LIMIT 1;
    IF v_route_id IS NULL THEN RAISE EXCEPTION 'Route not found'; END IF;
    INSERT INTO public.schedules (route_id, work_start_time, work_end_time, interval_min) VALUES (v_route_id, p_start, p_end, p_interval)
    ON CONFLICT (route_id) DO UPDATE SET work_start_time = EXCLUDED.work_start_time, work_end_time = EXCLUDED.work_end_time, interval_min = EXCLUDED.interval_min RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule(p_schedule_id bigint, p_start time DEFAULT NULL, p_end time DEFAULT NULL, p_interval integer DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
    UPDATE public.schedules
    SET work_start_time = COALESCE(p_start, work_start_time),
        work_end_time = COALESCE(p_end, work_end_time),
        interval_min = COALESCE(p_interval, interval_min)
    WHERE id = p_schedule_id;
END; $$;

CREATE OR REPLACE FUNCTION dispatcher_api.assign_driver_v2(p_driver_id bigint, p_fleet_number text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_vehicle_id bigint; BEGIN
    SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_fleet_number;
    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    INSERT INTO public.driver_vehicle_assignments (driver_id, vehicle_id, assigned_at) VALUES (p_driver_id, v_vehicle_id, now());
END; $$;

-- Dispatcher Views
CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_monitoring AS
SELECT v.id, v.fleet_number, r.number as route_number, tt.name as transport_type, v.last_lon, v.last_lat, v.last_recorded_at,
    CASE WHEN v.last_recorded_at > (now() - interval '5 minutes') THEN 'active' ELSE 'inactive' END as status, d.full_name as current_driver_name
FROM public.vehicles v JOIN public.routes r ON r.id = v.route_id JOIN public.transport_types tt ON tt.id = r.transport_type_id LEFT JOIN public.trips t ON t.vehicle_id = v.id AND t.ends_at IS NULL LEFT JOIN public.drivers d ON d.id = t.driver_id;

CREATE OR REPLACE VIEW dispatcher_api.v_schedules_list AS SELECT s.id, r.number as route_number, tt.name as transport_type, s.work_start_time, s.work_end_time, s.interval_min FROM public.schedules s JOIN public.routes r ON r.id = s.route_id JOIN public.transport_types tt ON tt.id = r.transport_type_id;

CREATE OR REPLACE VIEW dispatcher_api.v_active_trips AS
SELECT t.id, r.number as route_number, v.fleet_number, d.full_name, t.starts_at
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.drivers d ON d.id = t.driver_id
WHERE t.ends_at IS NULL;

CREATE OR REPLACE VIEW dispatcher_api.v_drivers_list AS SELECT id, full_name, login, phone, driver_license_number FROM public.drivers;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicles_list AS
SELECT v.id, v.fleet_number, v.route_id, r.number as route_number, v.vehicle_model_id, vm.capacity
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

CREATE OR REPLACE VIEW dispatcher_api.v_assignments_history AS
SELECT dva.id, dva.driver_id, d.full_name as driver_name, d.login as driver_login, d.phone as driver_phone,
       dva.vehicle_id, v.fleet_number, v.route_id, r.number as route_number, r.direction, tt.id as transport_type_id, tt.name as transport_type, dva.assigned_at
FROM public.driver_vehicle_assignments dva
JOIN public.drivers d ON d.id = dva.driver_id
JOIN public.vehicles v ON v.id = dva.vehicle_id
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id;


-- 2. ACCOUNTANT LOGIC
CREATE OR REPLACE FUNCTION accountant_api.upsert_budget(p_month date, p_income numeric DEFAULT 0, p_expenses numeric DEFAULT 0, p_note text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id bigint; BEGIN
    INSERT INTO public.budgets (month, income, expenses, note) VALUES (p_month, p_income, p_expenses, p_note)
    ON CONFLICT (month) DO UPDATE SET income = EXCLUDED.income, expenses = EXCLUDED.expenses, note = COALESCE(EXCLUDED.note, budgets.note) RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION accountant_api.add_expense(p_category text, p_amount numeric, p_description text DEFAULT NULL, p_document_ref text DEFAULT NULL, p_occurred_at timestamp DEFAULT now())
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id bigint; BEGIN
    INSERT INTO public.expenses (category, amount, description, document_ref, occurred_at) VALUES (p_category, p_amount, p_description, p_document_ref, p_occurred_at) RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION accountant_api.pay_salary(p_driver_id bigint DEFAULT NULL, p_employee_name text DEFAULT NULL, p_role text DEFAULT 'Інше', p_rate numeric DEFAULT 0, p_units integer DEFAULT 0, p_total numeric DEFAULT 0)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id bigint; v_final_total numeric; BEGIN
    IF p_total = 0 AND p_rate > 0 AND p_units > 0 THEN v_final_total := p_rate * p_units; ELSE v_final_total := p_total; END IF;
    IF v_final_total <= 0 THEN RAISE EXCEPTION 'Salary total must be positive'; END IF;
    INSERT INTO public.salary_payments (driver_id, employee_name, employee_role, rate, units, total, paid_at) VALUES (p_driver_id, p_employee_name, p_role, p_rate, p_units, v_final_total, now()) RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION accountant_api.get_financial_report(p_start_date date, p_end_date date)
RETURNS TABLE (category text, amount numeric, type text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
    RETURN QUERY SELECT 'Квитки'::text, COALESCE(SUM(price), 0), 'income'::text FROM public.tickets WHERE purchased_at >= p_start_date AND purchased_at < p_end_date + 1;
    RETURN QUERY SELECT 'Поповнення карток'::text, COALESCE(SUM(ct.amount), 0), 'income_flow'::text FROM public.card_top_ups ct WHERE topped_up_at >= p_start_date AND topped_up_at < p_end_date + 1;
    RETURN QUERY SELECT 'Штрафи'::text, COALESCE(SUM(f.amount), 0), 'income'::text FROM public.fines f WHERE status = 'Оплачено' AND issued_at >= p_start_date AND issued_at < p_end_date + 1;
    RETURN QUERY SELECT e.category, COALESCE(SUM(e.amount), 0), 'expense'::text FROM public.expenses e WHERE e.occurred_at >= p_start_date AND e.occurred_at < p_end_date + 1 GROUP BY e.category;
    RETURN QUERY SELECT 'Зарплата'::text, COALESCE(SUM(total), 0), 'expense'::text FROM public.salary_payments WHERE paid_at >= p_start_date AND paid_at < p_end_date + 1;
END; $$;

CREATE OR REPLACE VIEW accountant_api.v_budgets AS SELECT id, month, income as planned_income, expenses as planned_expenses, note FROM public.budgets ORDER BY month DESC;
CREATE OR REPLACE VIEW accountant_api.v_expenses AS SELECT * FROM public.expenses ORDER BY occurred_at DESC;
CREATE OR REPLACE VIEW accountant_api.v_salary_history AS SELECT sp.id, sp.paid_at, COALESCE(d.full_name, sp.employee_name) as employee_name, COALESCE(sp.employee_role, 'Водій') as role, sp.total FROM public.salary_payments sp LEFT JOIN public.drivers d ON d.id = sp.driver_id ORDER BY sp.paid_at DESC;
CREATE OR REPLACE VIEW accountant_api.v_drivers_list AS SELECT id, full_name, driver_license_number FROM public.drivers;


-- 3. MUNICIPALITY & MANAGER
CREATE OR REPLACE FUNCTION municipality_api.create_stop(p_name text, p_lon numeric, p_lat numeric)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id bigint; BEGIN INSERT INTO public.stops (name, lon, lat) VALUES (p_name, p_lon, p_lat) RETURNING id INTO v_id; RETURN v_id; END; $$;

CREATE OR REPLACE FUNCTION municipality_api.update_stop(p_id bigint, p_name text, p_lon numeric, p_lat numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN UPDATE public.stops SET name = p_name, lon = p_lon, lat = p_lat WHERE id = p_id; END; $$;

CREATE OR REPLACE FUNCTION municipality_api.create_route_full(p_number text, p_transport_type_id integer, p_direction text, p_stops_json jsonb, p_points_json jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
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

CREATE OR REPLACE FUNCTION municipality_api.get_passenger_flow(p_start_date date, p_end_date date, p_route_number text DEFAULT NULL, p_transport_type text DEFAULT NULL)
RETURNS TABLE (trip_date date, route_number text, transport_type text, fleet_number text, passenger_count integer) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
    RETURN QUERY SELECT t.starts_at::date, r.number, tt.name, v.fleet_number, t.passenger_count FROM public.trips t JOIN public.routes r ON r.id = t.route_id JOIN public.transport_types tt ON tt.id = r.transport_type_id JOIN public.vehicles v ON v.id = t.vehicle_id
    WHERE t.starts_at >= p_start_date AND t.starts_at < p_end_date + 1 AND (p_route_number IS NULL OR r.number = p_route_number) AND (p_transport_type IS NULL OR tt.name = p_transport_type) ORDER BY t.starts_at DESC;
END; $$;

CREATE OR REPLACE FUNCTION municipality_api.get_complaints(p_start_date date DEFAULT NULL, p_end_date date DEFAULT NULL, p_route_number text DEFAULT NULL, p_transport_type text DEFAULT NULL, p_fleet_number text DEFAULT NULL)
RETURNS TABLE (id bigint, type text, message text, status text, created_at timestamp, route_number text, transport_type text, fleet_number text, contact_info text) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog AS $$
BEGIN
    RETURN QUERY SELECT c.id, c.type, c.message, c.status, c.created_at, r.number, tt.name, v.fleet_number, c.contact_info
    FROM public.complaints_suggestions c
    LEFT JOIN public.routes r ON r.id = c.route_id
    LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
    LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
    WHERE (p_start_date IS NULL OR c.created_at >= p_start_date)
      AND (p_end_date IS NULL OR c.created_at < p_end_date + 1)
      AND (p_route_number IS NULL OR r.number = p_route_number)
      AND (p_transport_type IS NULL OR tt.name = p_transport_type)
      AND (p_fleet_number IS NULL OR v.fleet_number = p_fleet_number)
    ORDER BY c.created_at DESC;
END; $$;

CREATE OR REPLACE VIEW municipality_api.v_stops AS SELECT id, name, lon, lat FROM public.stops ORDER BY name;

CREATE OR REPLACE FUNCTION manager_api.hire_driver(p_login text, p_password text, p_email text, p_phone text, p_full_name text, p_license_number text, p_categories jsonb, p_passport_data jsonb)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog AS $$
DECLARE v_id bigint; BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password); END IF;
    EXECUTE format('GRANT ct_driver_role TO %I', p_login);
    INSERT INTO public.drivers (login, email, phone, full_name, driver_license_number, license_categories, passport_data) VALUES (p_login, p_email, p_phone, p_full_name, p_license_number, p_categories, p_passport_data) RETURNING id INTO v_id;
    RETURN v_id;
END; $$;

CREATE OR REPLACE FUNCTION manager_api.add_vehicle(
    p_fleet_number text,
    p_transport_type text,
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
    v_model_id bigint;
    v_route_id bigint;
    v_id bigint;
BEGIN
    -- Знаходимо або створюємо модель
    SELECT id INTO v_model_id FROM public.vehicle_models WHERE name = p_model_name AND capacity = p_capacity LIMIT 1;
    IF v_model_id IS NULL THEN
        INSERT INTO public.vehicle_models (name, capacity, manufacturer) VALUES (p_model_name, p_capacity, 'Unknown') RETURNING id INTO v_model_id;
    END IF;

    -- Знаходимо маршрут (якщо вказано)
    IF p_route_number IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        JOIN public.transport_types tt ON tt.id = r.transport_type_id
        WHERE r.number = p_route_number AND tt.name = p_transport_type
        LIMIT 1;
    END IF;

    INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id)
    VALUES (p_fleet_number, v_model_id, v_route_id)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW manager_api.v_drivers AS SELECT * FROM public.drivers;

CREATE OR REPLACE VIEW manager_api.v_vehicles AS
SELECT
    v.id,
    v.fleet_number,
    r.number as route_number,
    tt.name as transport_type,
    vm.name as model_name,
    vm.capacity
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

-- 4. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dispatcher_api TO ct_dispatcher_role;
GRANT SELECT ON ALL TABLES IN SCHEMA accountant_api TO ct_accountant_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accountant_api TO ct_accountant_role;
GRANT SELECT ON ALL TABLES IN SCHEMA municipality_api TO ct_municipality_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA municipality_api TO ct_municipality_role;
GRANT SELECT ON ALL TABLES IN SCHEMA manager_api TO ct_manager_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA manager_api TO ct_manager_role;
GRANT SELECT ON ALL TABLES IN SCHEMA admin_api TO ct_admin_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA admin_api TO ct_admin_role;
