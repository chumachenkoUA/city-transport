--
-- PostgreSQL database dump
--

-- Dumped from database version 16.9 (Debian 16.9-1.pgdg110+1)
-- Dumped by pg_dump version 16.9 (Debian 16.9-1.pgdg110+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: accountant_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA accountant_api;


ALTER SCHEMA accountant_api OWNER TO ct_migrator;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA auth;


ALTER SCHEMA auth OWNER TO ct_migrator;

--
-- Name: controller_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA controller_api;


ALTER SCHEMA controller_api OWNER TO ct_migrator;

--
-- Name: dispatcher_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA dispatcher_api;


ALTER SCHEMA dispatcher_api OWNER TO ct_migrator;

--
-- Name: driver_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA driver_api;


ALTER SCHEMA driver_api OWNER TO ct_migrator;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA drizzle;


ALTER SCHEMA drizzle OWNER TO ct_migrator;

--
-- Name: guest_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA guest_api;


ALTER SCHEMA guest_api OWNER TO ct_migrator;

--
-- Name: manager_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA manager_api;


ALTER SCHEMA manager_api OWNER TO ct_migrator;

--
-- Name: municipality_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA municipality_api;


ALTER SCHEMA municipality_api OWNER TO ct_migrator;

--
-- Name: passenger_api; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

CREATE SCHEMA passenger_api;


ALTER SCHEMA passenger_api OWNER TO ct_migrator;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: ct_migrator
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO ct_migrator;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: pgrouting; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgrouting WITH SCHEMA public;


--
-- Name: EXTENSION pgrouting; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pgrouting IS 'pgRouting Extension';


--
-- Name: add_expense(text, numeric, text, text, timestamp without time zone); Type: FUNCTION; Schema: accountant_api; Owner: ct_migrator
--

CREATE FUNCTION accountant_api.add_expense(p_category text, p_amount numeric, p_description text DEFAULT NULL::text, p_document_ref text DEFAULT NULL::text, p_occurred_at timestamp without time zone DEFAULT now()) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.expenses (category, amount, description, document_ref, occurred_at)
    VALUES (p_category, p_amount, p_description, p_document_ref, p_occurred_at)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


ALTER FUNCTION accountant_api.add_expense(p_category text, p_amount numeric, p_description text, p_document_ref text, p_occurred_at timestamp without time zone) OWNER TO ct_migrator;

--
-- Name: calculate_driver_salary(bigint, date); Type: FUNCTION; Schema: accountant_api; Owner: ct_migrator
--

CREATE FUNCTION accountant_api.calculate_driver_salary(p_driver_id bigint, p_month date) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_rate numeric; v_hours numeric;
BEGIN
    SELECT rate INTO v_rate FROM public.salary_payments
    WHERE driver_id = p_driver_id AND rate IS NOT NULL
    ORDER BY paid_at DESC LIMIT 1;

    IF v_rate IS NULL THEN
        RAISE EXCEPTION 'Rate not found for driver %', p_driver_id;
    END IF;

    -- Рахуємо години за completed рейсами
    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (t.actual_ends_at - t.actual_starts_at)) / 3600.0), 0)
    INTO v_hours FROM public.trips t
    WHERE t.driver_id = p_driver_id
      AND t.status = 'completed'
      AND t.actual_starts_at >= date_trunc('month', p_month)
      AND t.actual_starts_at < (date_trunc('month', p_month) + interval '1 month');

    RETURN round(v_hours * v_rate, 2);
END;
$$;


ALTER FUNCTION accountant_api.calculate_driver_salary(p_driver_id bigint, p_month date) OWNER TO ct_migrator;

--
-- Name: get_financial_report(date, date); Type: FUNCTION; Schema: accountant_api; Owner: ct_migrator
--

CREATE FUNCTION accountant_api.get_financial_report(p_start_date date, p_end_date date) RETURNS TABLE(category text, amount numeric, type text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    RETURN QUERY SELECT 'Квитки'::text, COALESCE(SUM(price), 0), 'income'::text
    FROM public.tickets WHERE purchased_at >= p_start_date AND purchased_at < p_end_date + 1;

    RETURN QUERY SELECT 'Поповнення карток'::text, COALESCE(SUM(ct.amount), 0), 'income_flow'::text
    FROM public.card_top_ups ct WHERE topped_up_at >= p_start_date AND topped_up_at < p_end_date + 1;

    RETURN QUERY SELECT 'Штрафи'::text, COALESCE(SUM(f.amount), 0), 'income'::text
    FROM public.fines f WHERE status = 'Оплачено' AND issued_at >= p_start_date AND issued_at < p_end_date + 1;

    RETURN QUERY SELECT e.category, COALESCE(SUM(e.amount), 0), 'expense'::text
    FROM public.expenses e WHERE e.occurred_at >= p_start_date AND e.occurred_at < p_end_date + 1
    GROUP BY e.category;

    RETURN QUERY SELECT 'Зарплата'::text, COALESCE(SUM(total), 0), 'expense'::text
    FROM public.salary_payments WHERE paid_at >= p_start_date AND paid_at < p_end_date + 1;
END;
$$;


ALTER FUNCTION accountant_api.get_financial_report(p_start_date date, p_end_date date) OWNER TO ct_migrator;

--
-- Name: pay_salary(bigint, numeric, integer, numeric); Type: FUNCTION; Schema: accountant_api; Owner: ct_migrator
--

CREATE FUNCTION accountant_api.pay_salary(p_driver_id bigint, p_rate numeric DEFAULT NULL::numeric, p_units integer DEFAULT NULL::integer, p_total numeric DEFAULT NULL::numeric) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_id bigint;
    v_final_total numeric;
    v_driver_exists boolean;
BEGIN
    -- Перевірка існування водія
    SELECT EXISTS(SELECT 1 FROM public.drivers WHERE id = p_driver_id) INTO v_driver_exists;
    IF NOT v_driver_exists THEN
        RAISE EXCEPTION 'Водія з ID % не знайдено', p_driver_id;
    END IF;

    -- Розрахунок суми
    IF p_total IS NOT NULL AND p_total > 0 THEN
        v_final_total := p_total;
    ELSIF p_rate IS NOT NULL AND p_rate > 0 AND p_units IS NOT NULL AND p_units > 0 THEN
        v_final_total := p_rate * p_units;
    ELSE
        RAISE EXCEPTION 'Вкажіть або total, або rate та units для розрахунку зарплати';
    END IF;

    INSERT INTO public.salary_payments (driver_id, rate, units, total, paid_at)
    VALUES (p_driver_id, p_rate, p_units, v_final_total, now())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


ALTER FUNCTION accountant_api.pay_salary(p_driver_id bigint, p_rate numeric, p_units integer, p_total numeric) OWNER TO ct_migrator;

--
-- Name: upsert_budget(date, numeric, numeric, text); Type: FUNCTION; Schema: accountant_api; Owner: ct_migrator
--

CREATE FUNCTION accountant_api.upsert_budget(p_month date, p_income numeric DEFAULT 0, p_expenses numeric DEFAULT 0, p_note text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.budgets (month, income, expenses, note)
    VALUES (p_month, p_income, p_expenses, p_note)
    ON CONFLICT (month) DO UPDATE SET
        income = EXCLUDED.income,
        expenses = EXCLUDED.expenses,
        note = COALESCE(EXCLUDED.note, budgets.note)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


ALTER FUNCTION accountant_api.upsert_budget(p_month date, p_income numeric, p_expenses numeric, p_note text) OWNER TO ct_migrator;

--
-- Name: register_passenger(text, text, text, text, text); Type: FUNCTION; Schema: auth; Owner: ct_migrator
--

CREATE FUNCTION auth.register_passenger(p_login text, p_password text, p_email text, p_phone text, p_full_name text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION auth.register_passenger(p_login text, p_password text, p_email text, p_phone text, p_full_name text) OWNER TO ct_migrator;

--
-- Name: get_active_trips(text, timestamp without time zone); Type: FUNCTION; Schema: controller_api; Owner: ct_migrator
--

CREATE FUNCTION controller_api.get_active_trips(p_fleet_number text, p_checked_at timestamp without time zone DEFAULT now()) RETURNS TABLE(trip_id bigint, planned_starts_at timestamp without time zone, actual_starts_at timestamp without time zone, route_number text, transport_type text, driver_name text, status text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION controller_api.get_active_trips(p_fleet_number text, p_checked_at timestamp without time zone) OWNER TO ct_migrator;

--
-- Name: issue_fine(text, numeric, text, text, timestamp without time zone, bigint); Type: FUNCTION; Schema: controller_api; Owner: ct_migrator
--

CREATE FUNCTION controller_api.issue_fine(p_card text, p_amt numeric, p_reason text, p_fleet text DEFAULT NULL::text, p_time timestamp without time zone DEFAULT now(), p_trip_id bigint DEFAULT NULL::bigint) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_u_id bigint;
    v_t_id bigint;
    v_trip_status text;
    v_driver_id bigint;
    v_vehicle_id bigint;
    v_f_id bigint;
BEGIN
    SELECT user_id INTO v_u_id FROM public.transport_cards WHERE card_number = p_card;
    IF v_u_id IS NULL THEN
        RAISE EXCEPTION 'Card % not found', p_card;
    END IF;

    IF p_trip_id IS NOT NULL THEN
        -- Отримуємо trip і driver_id та статус
        SELECT t.id, t.driver_id, t.status INTO v_t_id, v_driver_id, v_trip_status
        FROM public.trips t WHERE t.id = p_trip_id;

        IF v_t_id IS NULL THEN
            RAISE EXCEPTION 'Trip % not found', p_trip_id;
        END IF;

        -- SECURITY: Only allow fines on in_progress trips
        IF v_trip_status != 'in_progress' THEN
            RAISE EXCEPTION 'Cannot issue fine: trip % is not in progress (status: %)', p_trip_id, v_trip_status;
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


ALTER FUNCTION controller_api.issue_fine(p_card text, p_amt numeric, p_reason text, p_fleet text, p_time timestamp without time zone, p_trip_id bigint) OWNER TO ct_migrator;

--
-- Name: assign_driver_v2(bigint, text); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.assign_driver_v2(p_driver_id bigint, p_fleet_number text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_vehicle_id bigint;
BEGIN
    SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_fleet_number;
    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
    INSERT INTO public.driver_vehicle_assignments (driver_id, vehicle_id, assigned_at)
    VALUES (p_driver_id, v_vehicle_id, now());
END;
$$;


ALTER FUNCTION dispatcher_api.assign_driver_v2(p_driver_id bigint, p_fleet_number text) OWNER TO ct_migrator;

--
-- Name: calculate_delay(bigint); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.calculate_delay(p_trip_id bigint) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION dispatcher_api.calculate_delay(p_trip_id bigint) OWNER TO ct_migrator;

--
-- Name: cancel_trip(bigint); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.cancel_trip(p_trip_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION dispatcher_api.cancel_trip(p_trip_id bigint) OWNER TO ct_migrator;

--
-- Name: create_schedule(bigint, bigint, time without time zone, time without time zone, integer, boolean, boolean, boolean, boolean, boolean, boolean, boolean, date, date); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.create_schedule(p_route_id bigint, p_vehicle_id bigint, p_start time without time zone, p_end time without time zone, p_interval integer, p_monday boolean DEFAULT true, p_tuesday boolean DEFAULT true, p_wednesday boolean DEFAULT true, p_thursday boolean DEFAULT true, p_friday boolean DEFAULT true, p_saturday boolean DEFAULT false, p_sunday boolean DEFAULT false, p_valid_from date DEFAULT NULL::date, p_valid_to date DEFAULT NULL::date) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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
        monday, tuesday, wednesday, thursday, friday, saturday, sunday,
        valid_from, valid_to
    )
    VALUES (
        p_route_id, p_vehicle_id, p_start, p_end, p_interval,
        p_monday, p_tuesday, p_wednesday, p_thursday, p_friday, p_saturday, p_sunday,
        p_valid_from, p_valid_to
    )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


ALTER FUNCTION dispatcher_api.create_schedule(p_route_id bigint, p_vehicle_id bigint, p_start time without time zone, p_end time without time zone, p_interval integer, p_monday boolean, p_tuesday boolean, p_wednesday boolean, p_thursday boolean, p_friday boolean, p_saturday boolean, p_sunday boolean, p_valid_from date, p_valid_to date) OWNER TO ct_migrator;

--
-- Name: create_trip(bigint, bigint, timestamp without time zone, timestamp without time zone); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.create_trip(p_route_id bigint, p_driver_id bigint, p_planned_starts_at timestamp without time zone, p_planned_ends_at timestamp without time zone DEFAULT NULL::timestamp without time zone) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION dispatcher_api.create_trip(p_route_id bigint, p_driver_id bigint, p_planned_starts_at timestamp without time zone, p_planned_ends_at timestamp without time zone) OWNER TO ct_migrator;

--
-- Name: delete_schedule(bigint); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.delete_schedule(p_schedule_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    DELETE FROM public.schedules WHERE id = p_schedule_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Schedule % not found', p_schedule_id;
    END IF;
END;
$$;


ALTER FUNCTION dispatcher_api.delete_schedule(p_schedule_id bigint) OWNER TO ct_migrator;

--
-- Name: delete_trip(bigint); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.delete_trip(p_trip_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    DELETE FROM public.trips
    WHERE id = p_trip_id AND status = 'scheduled';

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip % not found or not in scheduled status', p_trip_id;
    END IF;
END;
$$;


ALTER FUNCTION dispatcher_api.delete_trip(p_trip_id bigint) OWNER TO ct_migrator;

--
-- Name: generate_daily_trips(bigint, bigint, date, time without time zone, time without time zone, integer, integer); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.generate_daily_trips(p_route_id bigint, p_driver_id bigint, p_date date, p_start_time time without time zone, p_end_time time without time zone, p_interval_min integer, p_trip_duration_min integer DEFAULT 60) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION dispatcher_api.generate_daily_trips(p_route_id bigint, p_driver_id bigint, p_date date, p_start_time time without time zone, p_end_time time without time zone, p_interval_min integer, p_trip_duration_min integer) OWNER TO ct_migrator;

--
-- Name: get_dashboard(); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.get_dashboard() RETURNS TABLE(active_trips integer, deviations integer, schedules_today integer, unassigned_drivers integer, unassigned_vehicles integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION dispatcher_api.get_dashboard() OWNER TO ct_migrator;

--
-- Name: get_departure_times(time without time zone, time without time zone, integer); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.get_departure_times(p_work_start_time time without time zone, p_work_end_time time without time zone, p_interval_min integer) RETURNS TABLE(departure_time text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION dispatcher_api.get_departure_times(p_work_start_time time without time zone, p_work_end_time time without time zone, p_interval_min integer) OWNER TO ct_migrator;

--
-- Name: update_schedule(bigint, bigint, bigint, time without time zone, time without time zone, integer, boolean, boolean, boolean, boolean, boolean, boolean, boolean, date, date); Type: FUNCTION; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE FUNCTION dispatcher_api.update_schedule(p_schedule_id bigint, p_route_id bigint DEFAULT NULL::bigint, p_vehicle_id bigint DEFAULT NULL::bigint, p_start time without time zone DEFAULT NULL::time without time zone, p_end time without time zone DEFAULT NULL::time without time zone, p_interval integer DEFAULT NULL::integer, p_monday boolean DEFAULT NULL::boolean, p_tuesday boolean DEFAULT NULL::boolean, p_wednesday boolean DEFAULT NULL::boolean, p_thursday boolean DEFAULT NULL::boolean, p_friday boolean DEFAULT NULL::boolean, p_saturday boolean DEFAULT NULL::boolean, p_sunday boolean DEFAULT NULL::boolean, p_valid_from date DEFAULT NULL::date, p_valid_to date DEFAULT NULL::date) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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
        sunday = COALESCE(p_sunday, sunday),
        valid_from = COALESCE(p_valid_from, valid_from),
        valid_to = COALESCE(p_valid_to, valid_to)
    WHERE id = p_schedule_id;
END;
$$;


ALTER FUNCTION dispatcher_api.update_schedule(p_schedule_id bigint, p_route_id bigint, p_vehicle_id bigint, p_start time without time zone, p_end time without time zone, p_interval integer, p_monday boolean, p_tuesday boolean, p_wednesday boolean, p_thursday boolean, p_friday boolean, p_saturday boolean, p_sunday boolean, p_valid_from date, p_valid_to date) OWNER TO ct_migrator;

--
-- Name: cleanup_stale_trips(bigint); Type: FUNCTION; Schema: driver_api; Owner: ct_migrator
--

CREATE FUNCTION driver_api.cleanup_stale_trips(p_driver_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION driver_api.cleanup_stale_trips(p_driver_id bigint) OWNER TO ct_migrator;

--
-- Name: finish_trip(timestamp without time zone); Type: FUNCTION; Schema: driver_api; Owner: ct_migrator
--

CREATE FUNCTION driver_api.finish_trip(p_ended_at timestamp without time zone DEFAULT now()) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION driver_api.finish_trip(p_ended_at timestamp without time zone) OWNER TO ct_migrator;

--
-- Name: log_vehicle_gps(numeric, numeric, timestamp without time zone); Type: FUNCTION; Schema: driver_api; Owner: ct_migrator
--

CREATE FUNCTION driver_api.log_vehicle_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone DEFAULT now()) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_driver_id bigint; v_vehicle_id bigint;
BEGIN
    SELECT id INTO v_driver_id FROM public.drivers WHERE login = session_user;

    -- Перевірка чи є активний рейс
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE driver_id = v_driver_id AND status = 'in_progress') THEN
        RAISE EXCEPTION 'no active trip';
    END IF;

    -- Отримуємо vehicle_id з driver_vehicle_assignments
    -- ORDER BY assigned_at DESC: найостанніше призначення
    SELECT dva.vehicle_id INTO v_vehicle_id
    FROM public.driver_vehicle_assignments dva
    WHERE dva.driver_id = v_driver_id
    ORDER BY dva.assigned_at DESC
    LIMIT 1;

    IF v_vehicle_id IS NULL THEN RAISE EXCEPTION 'no vehicle assigned'; END IF;

    INSERT INTO public.vehicle_gps_logs (vehicle_id, lon, lat, recorded_at)
    VALUES (v_vehicle_id, p_lon, p_lat, p_recorded_at);
END;
$$;


ALTER FUNCTION driver_api.log_vehicle_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone) OWNER TO ct_migrator;

--
-- Name: start_trip(bigint, timestamp without time zone); Type: FUNCTION; Schema: driver_api; Owner: ct_migrator
--

CREATE FUNCTION driver_api.start_trip(p_trip_id bigint DEFAULT NULL::bigint, p_started_at timestamp without time zone DEFAULT now()) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION driver_api.start_trip(p_trip_id bigint, p_started_at timestamp without time zone) OWNER TO ct_migrator;

--
-- Name: update_passengers(bigint, integer); Type: FUNCTION; Schema: driver_api; Owner: ct_migrator
--

CREATE FUNCTION driver_api.update_passengers(p_trip_id bigint, p_passenger_count integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
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


ALTER FUNCTION driver_api.update_passengers(p_trip_id bigint, p_passenger_count integer) OWNER TO ct_migrator;

--
-- Name: find_nearby_stops(numeric, numeric, numeric, integer); Type: FUNCTION; Schema: guest_api; Owner: ct_migrator
--

CREATE FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer DEFAULT 10) RETURNS TABLE(id bigint, name text, lon numeric, lat numeric, distance_m double precision)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.lon, s.lat,
           ST_Distance(
               ST_SetSRID(ST_MakePoint(p_lon::float8, p_lat::float8), 4326)::geography,
               ST_SetSRID(ST_MakePoint(s.lon::float8, s.lat::float8), 4326)::geography
           ) AS distance_m
    FROM public.stops s
    WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(p_lon::float8, p_lat::float8), 4326)::geography,
        ST_SetSRID(ST_MakePoint(s.lon::float8, s.lat::float8), 4326)::geography,
        p_radius_m
    )
    ORDER BY distance_m
    LIMIT p_limit;
END;
$$;


ALTER FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) OWNER TO ct_migrator;

--
-- Name: find_nearest_stop_to_point(numeric, numeric, integer); Type: FUNCTION; Schema: guest_api; Owner: ct_migrator
--

CREATE FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer DEFAULT 1) RETURNS TABLE(id bigint, name text, lon numeric, lat numeric, distance_meters numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.lon,
    s.lat,
    ST_DistanceSphere(
      ST_MakePoint(p_lon::float, p_lat::float),
      ST_MakePoint(s.lon::float, s.lat::float)
    )::numeric AS distance_meters
  FROM public.stops s
  ORDER BY distance_meters
  LIMIT p_limit;
END;
$$;


ALTER FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) OWNER TO ct_migrator;

--
-- Name: get_route_stops_with_timing(bigint); Type: FUNCTION; Schema: guest_api; Owner: ct_migrator
--

CREATE FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) RETURNS TABLE(id bigint, stop_id bigint, stop_name text, lon numeric, lat numeric, sort_order integer, distance_to_next_km numeric, minutes_to_next_stop numeric, minutes_from_start numeric)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
  v_avg_speed_kmh CONSTANT numeric := 25;
BEGIN
  RETURN QUERY
  WITH ordered_stops AS (
    SELECT os.id, os.stop_id, os.stop_name, os.lon, os.lat, os.sort_order, os.distance_to_next_km
    FROM guest_api.v_route_stops_ordered os
    WHERE os.route_id = p_route_id
  ),
  with_timing AS (
    SELECT
      os.id,
      os.stop_id,
      os.stop_name,
      os.lon,
      os.lat,
      os.sort_order,
      os.distance_to_next_km,
      CASE
        WHEN os.distance_to_next_km IS NOT NULL
        THEN ROUND((os.distance_to_next_km / v_avg_speed_kmh) * 60, 1)
        ELSE NULL
      END AS minutes_to_next_stop,
      ROUND(COALESCE(SUM(os.distance_to_next_km)
        OVER (ORDER BY os.sort_order ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0)
        / v_avg_speed_kmh * 60, 1) AS minutes_from_start
    FROM ordered_stops os
  )
  SELECT wt.id, wt.stop_id, wt.stop_name, wt.lon, wt.lat, wt.sort_order,
         wt.distance_to_next_km, wt.minutes_to_next_stop, wt.minutes_from_start
  FROM with_timing wt
  ORDER BY wt.sort_order;
END;
$$;


ALTER FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) OWNER TO ct_migrator;

--
-- Name: plan_route(numeric, numeric, numeric, numeric, numeric, integer, integer); Type: FUNCTION; Schema: guest_api; Owner: ct_migrator
--

CREATE FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric DEFAULT 500, p_max_wait_min integer DEFAULT 10, p_max_results integer DEFAULT 5) RETURNS TABLE(route_option jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_current_time time;
    v_current_minutes integer;
BEGIN
    v_current_time := CURRENT_TIME;
    v_current_minutes := EXTRACT(HOUR FROM v_current_time) * 60 + EXTRACT(MINUTE FROM v_current_time);

    RETURN QUERY
    WITH
    stops_a AS (
        SELECT id, name, lon, lat, distance_m
        FROM guest_api.find_nearby_stops(p_lon_a, p_lat_a, p_radius_m, 3)
    ),
    stops_b AS (
        SELECT id, name, lon, lat, distance_m
        FROM guest_api.find_nearby_stops(p_lon_b, p_lat_b, p_radius_m, 3)
    ),
    potential_routes AS (
        SELECT DISTINCT r.id, r.number, r.transport_type_id, r.direction, tt.name as transport_type
        FROM routes r
        JOIN route_stops rsa ON rsa.route_id = r.id
        JOIN stops_a sa ON rsa.stop_id = sa.id
        JOIN route_stops rsb ON rsb.route_id = r.id
        JOIN stops_b sb ON rsb.stop_id = sb.id
        JOIN transport_types tt ON tt.id = r.transport_type_id
        WHERE r.is_active = true
    ),
    route_paths AS (
        SELECT rp.route_id, rp.stop_id, rp.path_seq, rp.accum_dist
        FROM (
            WITH RECURSIVE traversal AS (
                SELECT rs.id, rs.route_id, rs.stop_id, rs.next_route_stop_id, rs.distance_to_next_km,
                       1 as path_seq, 0::numeric as accum_dist
                FROM route_stops rs
                JOIN potential_routes pr ON rs.route_id = pr.id
                WHERE rs.prev_route_stop_id IS NULL
                UNION ALL
                SELECT next_rs.id, next_rs.route_id, next_rs.stop_id, next_rs.next_route_stop_id,
                       next_rs.distance_to_next_km, t.path_seq + 1,
                       t.accum_dist + COALESCE(t.distance_to_next_km, 0)::numeric
                FROM route_stops next_rs
                JOIN traversal t ON next_rs.id = t.next_route_stop_id
                WHERE t.path_seq < 1000
            )
            SELECT t.route_id, t.stop_id, t.path_seq, t.accum_dist FROM traversal t
        ) rp
    ),
    valid_segments AS (
        SELECT pr.id AS route_id, pr.number AS route_number, pr.transport_type,
               pr.transport_type_id, pr.direction, sa.id AS stop_a_id, sb.id AS stop_b_id,
               (rb.accum_dist - ra.accum_dist) AS distance_km
        FROM potential_routes pr
        JOIN route_paths ra ON ra.route_id = pr.id
        JOIN stops_a sa ON ra.stop_id = sa.id
        JOIN route_paths rb ON rb.route_id = pr.id
        JOIN stops_b sb ON rb.stop_id = sb.id
        WHERE ra.path_seq < rb.path_seq
    ),
    segments_with_schedule AS (
        SELECT vs.*,
               ROUND((vs.distance_km / 25.0) * 60)::integer AS travel_min,
               (CASE WHEN s.interval_min > 0 THEN
                   EXTRACT(HOUR FROM s.work_start_time)::integer * 60 +
                   EXTRACT(MINUTE FROM s.work_start_time)::integer +
                   (CEIL(GREATEST(0, v_current_minutes - (EXTRACT(HOUR FROM s.work_start_time)::integer * 60 +
                    EXTRACT(MINUTE FROM s.work_start_time)::integer))::numeric / s.interval_min) * s.interval_min)
               ELSE NULL END)::integer AS next_departure_min
        FROM valid_segments vs
        LEFT JOIN schedules s ON s.route_id = vs.route_id
        WHERE vs.distance_km > 0 AND s.interval_min > 0 AND s.work_start_time IS NOT NULL
    )
    SELECT jsonb_build_object(
        'totalTimeMin', sws.travel_min,
        'totalDistanceKm', sws.distance_km,
        'transferCount', 0,
        'segments', jsonb_build_array(jsonb_build_object(
            'routeId', sws.route_id,
            'routeNumber', sws.route_number,
            'transportType', sws.transport_type,
            'transportTypeId', sws.transport_type_id,
            'direction', sws.direction,
            'fromStop', jsonb_build_object(
                'id', sws.stop_a_id,
                'name', (SELECT name FROM stops WHERE id = sws.stop_a_id),
                'lon', (SELECT lon FROM stops WHERE id = sws.stop_a_id),
                'lat', (SELECT lat FROM stops WHERE id = sws.stop_a_id)
            ),
            'toStop', jsonb_build_object(
                'id', sws.stop_b_id,
                'name', (SELECT name FROM stops WHERE id = sws.stop_b_id),
                'lon', (SELECT lon FROM stops WHERE id = sws.stop_b_id),
                'lat', (SELECT lat FROM stops WHERE id = sws.stop_b_id)
            ),
            'distanceKm', sws.distance_km,
            'travelTimeMin', sws.travel_min,
            'departureTime', TO_CHAR((sws.next_departure_min || ' minutes')::interval, 'HH24:MI'),
            'arrivalTime', TO_CHAR((sws.next_departure_min + sws.travel_min || ' minutes')::interval, 'HH24:MI')
        ))
    ) AS route_option
    FROM segments_with_schedule sws
    WHERE sws.next_departure_min IS NOT NULL
    ORDER BY sws.travel_min
    LIMIT p_max_results;
END;
$$;


ALTER FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) OWNER TO ct_migrator;

--
-- Name: plan_route_pgrouting(bigint[], bigint[], integer, integer); Type: FUNCTION; Schema: guest_api; Owner: ct_migrator
--

CREATE FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer DEFAULT 8, p_max_paths integer DEFAULT 5) RETURNS TABLE(seq integer, node bigint, edge bigint, cost double precision, agg_cost double precision, route_id bigint, stop_id bigint, path_id integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $_$
DECLARE
    v_edge_count integer;
    v_edges_sql text;
    v_start_nodes bigint[];
    v_end_nodes bigint[];
BEGIN
    -- ============================================================================
    -- GUARD: Перевірка наявності pgRouting
    -- ============================================================================
    -- Перевіряємо чи встановлено extension pgrouting
    -- Це дозволяє системі працювати БЕЗ pgRouting (graceful degradation)
    -- Якщо pgrouting не встановлено - функція просто повертає пустий результат
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgrouting') THEN
        RAISE NOTICE 'pgrouting extension is not installed';
        RETURN;
    END IF;

    SELECT array_agg(rs.id) INTO v_start_nodes
    FROM public.route_stops rs WHERE rs.stop_id = ANY(p_start_stop_ids);

    SELECT array_agg(rs.id) INTO v_end_nodes
    FROM public.route_stops rs WHERE rs.stop_id = ANY(p_end_stop_ids);

    IF v_start_nodes IS NULL OR v_end_nodes IS NULL THEN RETURN; END IF;

    SELECT count(*) INTO v_edge_count
    FROM public.route_stops rs
    WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL;

    v_edges_sql := format($f$
        SELECT id, source, target, cost, reverse_cost FROM (
            SELECT row_number() OVER () AS id, rs.id AS source, rs.next_route_stop_id AS target,
                   (COALESCE(rs.distance_to_next_km, 0) / 25.0) * 60.0 AS cost,
                   -1::double precision AS reverse_cost
            FROM public.route_stops rs
            WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL
            UNION ALL
            SELECT row_number() OVER () + %s AS id, rs_from.id AS source, rs_to.id AS target,
                   %s::double precision AS cost, -1::double precision AS reverse_cost
            FROM public.route_stops rs_from
            JOIN public.route_stops rs_to ON rs_from.stop_id = rs_to.stop_id AND rs_from.id <> rs_to.id
        ) edges
    $f$, v_edge_count, p_transfer_penalty);

    RETURN QUERY
    WITH edges AS (
        SELECT row_number() OVER () AS id, rs.id AS source, rs.next_route_stop_id AS target,
               (COALESCE(rs.distance_to_next_km, 0) / 25.0) * 60.0 AS cost,
               -1::double precision AS reverse_cost, rs.route_id AS route_id
        FROM public.route_stops rs
        WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL
        UNION ALL
        SELECT row_number() OVER () + v_edge_count AS id, rs_from.id AS source, rs_to.id AS target,
               p_transfer_penalty::double precision AS cost, -1::double precision AS reverse_cost,
               NULL::bigint AS route_id
        FROM public.route_stops rs_from
        JOIN public.route_stops rs_to ON rs_from.stop_id = rs_to.stop_id AND rs_from.id <> rs_to.id
    ),
    path AS (
        SELECT * FROM pgr_dijkstra(v_edges_sql, v_start_nodes, v_end_nodes, directed := true)
    ),
    best AS (
        SELECT p.start_vid, p.end_vid, MIN(p.agg_cost) AS total_cost
        FROM path p GROUP BY p.start_vid, p.end_vid
    ),
    ranked AS (
        SELECT b.start_vid, b.end_vid, b.total_cost,
               row_number() OVER (ORDER BY b.total_cost) AS path_id
        FROM best b ORDER BY b.total_cost LIMIT p_max_paths
    )
    SELECT p.seq, p.node, p.edge, p.cost, p.agg_cost, e.route_id, rs.stop_id, r.path_id::integer
    FROM path p
    JOIN ranked r ON r.start_vid = p.start_vid AND r.end_vid = p.end_vid
    LEFT JOIN edges e ON e.id = p.edge
    LEFT JOIN public.route_stops rs ON rs.id = p.node
    ORDER BY r.path_id, p.seq;
END;
$_$;


ALTER FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) OWNER TO ct_migrator;

--
-- Name: search_stops_by_name(text, integer); Type: FUNCTION; Schema: guest_api; Owner: ct_migrator
--

CREATE FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer DEFAULT 10) RETURNS TABLE(id bigint, name text, lon numeric, lat numeric)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
    SELECT s.id, s.name, s.lon, s.lat
    FROM stops s
    WHERE s.name ILIKE '%' || p_query || '%'
    ORDER BY CASE WHEN s.name ILIKE p_query || '%' THEN 1 ELSE 2 END, s.name
    LIMIT p_limit;
$$;


ALTER FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) OWNER TO ct_migrator;

--
-- Name: submit_complaint(text, text, text, text, text, text); Type: FUNCTION; Schema: guest_api; Owner: ct_migrator
--

CREATE FUNCTION guest_api.submit_complaint(p_type text, p_message text, p_contact_info text DEFAULT NULL::text, p_route_number text DEFAULT NULL::text, p_transport_type text DEFAULT NULL::text, p_vehicle_number text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_route_id INT;
    v_vehicle_id BIGINT;
BEGIN
    -- Validate complaint type
    IF p_type NOT IN ('complaint', 'suggestion') THEN
        RAISE EXCEPTION 'Invalid type: %. Must be complaint or suggestion', p_type;
    END IF;

    -- Validate message length
    IF length(p_message) > 5000 THEN
        RAISE EXCEPTION 'Message too long (max 5000 characters)';
    END IF;

    -- Validate route if provided
    IF p_route_number IS NOT NULL AND p_transport_type IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        JOIN public.transport_types tt ON tt.id = r.transport_type_id
        WHERE r.number = p_route_number AND tt.name = p_transport_type
        LIMIT 1;

        IF v_route_id IS NULL THEN
            RAISE EXCEPTION 'Route not found: % (%)', p_route_number, p_transport_type;
        END IF;
    END IF;

    -- Validate vehicle if provided
    IF p_vehicle_number IS NOT NULL THEN
        SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_vehicle_number LIMIT 1;

        IF v_vehicle_id IS NULL THEN
            RAISE EXCEPTION 'Vehicle not found: %', p_vehicle_number;
        END IF;
    END IF;

    INSERT INTO public.complaints_suggestions (
        user_id, type, message, trip_id, status, created_at,
        route_id, vehicle_id, contact_info
    )
    VALUES (NULL, p_type, p_message, NULL, 'Подано', now(), v_route_id, v_vehicle_id, p_contact_info);
END;
$$;


ALTER FUNCTION guest_api.submit_complaint(p_type text, p_message text, p_contact_info text, p_route_number text, p_transport_type text, p_vehicle_number text) OWNER TO ct_migrator;

--
-- Name: add_vehicle(text, bigint, text); Type: FUNCTION; Schema: manager_api; Owner: ct_migrator
--

CREATE FUNCTION manager_api.add_vehicle(p_fleet_number text, p_model_id bigint, p_route_number text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_route_id bigint;
    v_type_id integer;
    v_type_name text;
    v_id bigint;
BEGIN
    -- Check model exists and get type
    SELECT vm.type_id, tt.name INTO v_type_id, v_type_name
    FROM public.vehicle_models vm
    JOIN public.transport_types tt ON tt.id = vm.type_id
    WHERE vm.id = p_model_id;

    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'Vehicle model not found';
    END IF;

    -- Find route if provided
    IF p_route_number IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        WHERE r.number = p_route_number AND r.transport_type_id = v_type_id
        LIMIT 1;

        IF v_route_id IS NULL THEN
            RAISE EXCEPTION 'Route "%" not found for transport type "%". Please select a compatible route.', p_route_number, v_type_name;
        END IF;
    ELSE
        RAISE EXCEPTION 'Route number is required';
    END IF;

    INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id)
    VALUES (p_fleet_number, p_model_id, v_route_id)
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$;


ALTER FUNCTION manager_api.add_vehicle(p_fleet_number text, p_model_id bigint, p_route_number text) OWNER TO ct_migrator;

--
-- Name: add_vehicle_v2(text, bigint, bigint, text); Type: FUNCTION; Schema: manager_api; Owner: ct_migrator
--

CREATE FUNCTION manager_api.add_vehicle_v2(p_fleet_number text, p_model_id bigint, p_route_id bigint DEFAULT NULL::bigint, p_route_number text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_model_type_id integer;
    v_route_id bigint;
    v_vehicle_id bigint;
BEGIN
    SELECT type_id INTO v_model_type_id FROM public.vehicle_models WHERE id = p_model_id;
    IF v_model_type_id IS NULL THEN
        RAISE EXCEPTION 'Vehicle model % not found', p_model_id;
    END IF;

    v_route_id := p_route_id;
    IF v_route_id IS NULL AND p_route_number IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        WHERE r.number = p_route_number AND r.transport_type_id = v_model_type_id
        ORDER BY CASE r.direction WHEN 'forward' THEN 0 ELSE 1 END
        LIMIT 1;
    END IF;

    IF v_route_id IS NULL THEN
        RAISE EXCEPTION 'Route is required';
    END IF;

    INSERT INTO public.vehicles (fleet_number, vehicle_model_id, route_id)
    VALUES (p_fleet_number, p_model_id, v_route_id)
    RETURNING id INTO v_vehicle_id;

    RETURN v_vehicle_id;
END;
$$;


ALTER FUNCTION manager_api.add_vehicle_v2(p_fleet_number text, p_model_id bigint, p_route_id bigint, p_route_number text) OWNER TO ct_migrator;

--
-- Name: create_staff_user(text, text, text, text, text, text); Type: FUNCTION; Schema: manager_api; Owner: ct_migrator
--

CREATE FUNCTION manager_api.create_staff_user(p_login text, p_password text, p_role text, p_full_name text DEFAULT NULL::text, p_email text DEFAULT NULL::text, p_phone text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    -- SECURITY: Removed 'manager' to prevent privilege escalation
    -- Managers should not be able to create other managers
    v_allowed_roles text[] := ARRAY['dispatcher', 'controller', 'accountant', 'municipality'];
    v_pg_role text;
BEGIN
    -- Validate role is in whitelist
    IF p_role NOT IN (SELECT unnest(v_allowed_roles)) THEN
        RAISE EXCEPTION 'Invalid role: %. Allowed roles: %', p_role, array_to_string(v_allowed_roles, ', ');
    END IF;

    -- Map role to PostgreSQL role name
    v_pg_role := 'ct_' || p_role || '_role';

    -- Check if login already exists
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        RAISE EXCEPTION 'Login % already exists', p_login;
    END IF;

    -- Create the PostgreSQL role with login privileges
    EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);

    -- Grant the appropriate business role
    EXECUTE format('GRANT %I TO %I', v_pg_role, p_login);

    -- Note: Staff users don't need entries in users/drivers tables
    -- They authenticate directly via their PostgreSQL role
    -- Their login is used as session_user in API functions

    RAISE NOTICE 'Created staff user % with role %', p_login, v_pg_role;
EXCEPTION
    WHEN others THEN
        -- Cleanup if something fails
        EXECUTE format('DROP ROLE IF EXISTS %I', p_login);
        RAISE;
END;
$$;


ALTER FUNCTION manager_api.create_staff_user(p_login text, p_password text, p_role text, p_full_name text, p_email text, p_phone text) OWNER TO ct_migrator;

--
-- Name: hire_driver(text, text, text, text, text, text, jsonb, jsonb); Type: FUNCTION; Schema: manager_api; Owner: ct_migrator
--

CREATE FUNCTION manager_api.hire_driver(p_login text, p_password text, p_email text, p_phone text, p_full_name text, p_license_number text, p_categories jsonb, p_passport_data jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_id bigint;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', p_login, p_password);
    END IF;
    EXECUTE format('GRANT ct_driver_role TO %I', p_login);

    INSERT INTO public.drivers (login, email, phone, full_name, driver_license_number, license_categories, passport_data)
    VALUES (p_login, p_email, p_phone, p_full_name, p_license_number, p_categories, p_passport_data)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


ALTER FUNCTION manager_api.hire_driver(p_login text, p_password text, p_email text, p_phone text, p_full_name text, p_license_number text, p_categories jsonb, p_passport_data jsonb) OWNER TO ct_migrator;

--
-- Name: remove_staff_user(text); Type: FUNCTION; Schema: manager_api; Owner: ct_migrator
--

CREATE FUNCTION manager_api.remove_staff_user(p_login text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    -- Prevent removing certain critical accounts
    IF p_login IN ('ct_migrator', 'postgres') THEN
        RAISE EXCEPTION 'Cannot remove system account: %', p_login;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = p_login) THEN
        RAISE EXCEPTION 'User % not found', p_login;
    END IF;

    EXECUTE format('DROP ROLE IF EXISTS %I', p_login);

    RAISE NOTICE 'Removed staff user %', p_login;
END;
$$;


ALTER FUNCTION manager_api.remove_staff_user(p_login text) OWNER TO ct_migrator;

--
-- Name: create_route_full(text, integer, text, jsonb, jsonb); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.create_route_full(p_number text, p_transport_type_id integer, p_direction text, p_stops_json jsonb, p_points_json jsonb) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_route_id bigint;
    v_stop record;
    v_point record;
    v_prev_stop_id bigint := NULL;
    v_current_stop_id bigint;
    v_new_stop_id bigint;
    v_prev_point_id bigint := NULL;
    v_current_point_id bigint;
BEGIN
    INSERT INTO public.routes (number, transport_type_id, direction, is_active)
    VALUES (p_number, p_transport_type_id, p_direction, true)
    RETURNING id INTO v_route_id;

    FOR v_stop IN
        SELECT * FROM jsonb_to_recordset(p_stops_json)
            AS x(stop_id bigint, name text, lon numeric, lat numeric, distance_to_next_km numeric)
    LOOP
        IF v_stop.stop_id IS NOT NULL THEN
            v_new_stop_id := v_stop.stop_id;
        ELSE
            INSERT INTO public.stops (name, lon, lat)
            VALUES (v_stop.name, v_stop.lon, v_stop.lat)
            RETURNING id INTO v_new_stop_id;
        END IF;

        INSERT INTO public.route_stops (route_id, stop_id, prev_route_stop_id, distance_to_next_km)
        VALUES (v_route_id, v_new_stop_id, v_prev_stop_id, v_stop.distance_to_next_km)
        RETURNING id INTO v_current_stop_id;

        IF v_prev_stop_id IS NOT NULL THEN
            UPDATE public.route_stops SET next_route_stop_id = v_current_stop_id WHERE id = v_prev_stop_id;
        END IF;

        v_prev_stop_id := v_current_stop_id;
    END LOOP;

    FOR v_point IN
        SELECT * FROM jsonb_to_recordset(p_points_json) AS x(lon numeric, lat numeric)
    LOOP
        INSERT INTO public.route_points (route_id, lon, lat, prev_route_point_id)
        VALUES (v_route_id, v_point.lon, v_point.lat, v_prev_point_id)
        RETURNING id INTO v_current_point_id;

        IF v_prev_point_id IS NOT NULL THEN
            UPDATE public.route_points SET next_route_point_id = v_current_point_id WHERE id = v_prev_point_id;
        END IF;

        v_prev_point_id := v_current_point_id;
    END LOOP;

    PERFORM municipality_api.recalculate_route_stop_distances(v_route_id);

    RETURN v_route_id;
END;
$$;


ALTER FUNCTION municipality_api.create_route_full(p_number text, p_transport_type_id integer, p_direction text, p_stops_json jsonb, p_points_json jsonb) OWNER TO ct_migrator;

--
-- Name: create_stop(text, numeric, numeric); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.create_stop(p_name text, p_lon numeric, p_lat numeric) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.stops (name, lon, lat) VALUES (p_name, p_lon, p_lat) RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


ALTER FUNCTION municipality_api.create_stop(p_name text, p_lon numeric, p_lat numeric) OWNER TO ct_migrator;

--
-- Name: get_complaints(date, date, text, text, text); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.get_complaints(p_start_date date DEFAULT NULL::date, p_end_date date DEFAULT NULL::date, p_route_number text DEFAULT NULL::text, p_transport_type text DEFAULT NULL::text, p_fleet_number text DEFAULT NULL::text) RETURNS TABLE(id bigint, type text, message text, status text, created_at timestamp without time zone, route_number text, transport_type text, fleet_number text, contact_info text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.type, c.message, c.status, c.created_at, r.number, tt.name, v.fleet_number, c.contact_info
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
END;
$$;


ALTER FUNCTION municipality_api.get_complaints(p_start_date date, p_end_date date, p_route_number text, p_transport_type text, p_fleet_number text) OWNER TO ct_migrator;

--
-- Name: get_flow_summary(date, date, text, integer); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.get_flow_summary(p_from date, p_to date, p_route_number text DEFAULT NULL::text, p_transport_type_id integer DEFAULT NULL::integer) RETURNS TABLE(total_passengers bigint, total_trips bigint, avg_per_trip numeric, avg_per_day numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT
    COALESCE(SUM(f.passenger_count), 0)::bigint,
    COALESCE(COUNT(*), 0)::bigint,
    COALESCE(ROUND(AVG(f.passenger_count), 1), 0),
    COALESCE(
      ROUND(SUM(f.passenger_count)::numeric / NULLIF(COUNT(DISTINCT f.trip_date), 0), 1),
      0
    )
  FROM municipality_api.v_trip_passenger_fact f
  WHERE f.trip_date BETWEEN p_from AND p_to
    AND (p_route_number IS NULL OR f.route_number = p_route_number)
    AND (p_transport_type_id IS NULL OR f.transport_type_id = p_transport_type_id);
$$;


ALTER FUNCTION municipality_api.get_flow_summary(p_from date, p_to date, p_route_number text, p_transport_type_id integer) OWNER TO ct_migrator;

--
-- Name: get_passenger_flow(date, date, text, text); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.get_passenger_flow(p_start_date date, p_end_date date, p_route_number text DEFAULT NULL::text, p_transport_type text DEFAULT NULL::text) RETURNS TABLE(trip_date date, route_number text, transport_type text, fleet_number text, passenger_count integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    RETURN QUERY
    SELECT t.actual_starts_at::date, r.number, tt.name, v.fleet_number, t.passenger_count
    FROM public.trips t
    JOIN public.routes r ON r.id = t.route_id
    JOIN public.transport_types tt ON tt.id = r.transport_type_id
    LEFT JOIN public.driver_vehicle_assignments dva ON dva.driver_id = t.driver_id
    LEFT JOIN public.vehicles v ON v.id = dva.vehicle_id
    WHERE t.status = 'completed'
      AND t.actual_starts_at >= p_start_date AND t.actual_starts_at < p_end_date + 1
      AND (p_route_number IS NULL OR r.number = p_route_number)
      AND (p_transport_type IS NULL OR tt.name = p_transport_type)
    ORDER BY t.actual_starts_at DESC;
END;
$$;


ALTER FUNCTION municipality_api.get_passenger_flow(p_start_date date, p_end_date date, p_route_number text, p_transport_type text) OWNER TO ct_migrator;

--
-- Name: get_passenger_trend(date, date, text, integer); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.get_passenger_trend(p_from date, p_to date, p_route_number text DEFAULT NULL::text, p_transport_type_id integer DEFAULT NULL::integer) RETURNS TABLE(trip_date date, daily_passengers bigint, moving_avg_7d integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT
    trip_date,
    daily_passengers,
    AVG(daily_passengers) OVER (
      ORDER BY trip_date
      ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    )::integer AS moving_avg_7d
  FROM (
    SELECT
      f.trip_date,
      COALESCE(SUM(f.passenger_count), 0)::bigint AS daily_passengers
    FROM municipality_api.v_trip_passenger_fact f
    WHERE f.trip_date BETWEEN p_from AND p_to
      AND (p_route_number IS NULL OR f.route_number = p_route_number)
      AND (p_transport_type_id IS NULL OR f.transport_type_id = p_transport_type_id)
    GROUP BY f.trip_date
  ) daily
  ORDER BY trip_date;
$$;


ALTER FUNCTION municipality_api.get_passenger_trend(p_from date, p_to date, p_route_number text, p_transport_type_id integer) OWNER TO ct_migrator;

--
-- Name: get_top_routes(date, date, integer, integer); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.get_top_routes(p_from date, p_to date, p_transport_type_id integer DEFAULT NULL::integer, p_limit integer DEFAULT 5) RETURNS TABLE(route_number text, transport_type text, total_passengers bigint, rank integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  SELECT route_number, transport_type, total_passengers, rnk::integer
  FROM (
    SELECT
      f.route_number,
      f.transport_type,
      COALESCE(SUM(f.passenger_count), 0)::bigint AS total_passengers,
      RANK() OVER (ORDER BY COALESCE(SUM(f.passenger_count), 0) DESC) AS rnk
    FROM municipality_api.v_trip_passenger_fact f
    WHERE f.trip_date BETWEEN p_from AND p_to
      AND (p_transport_type_id IS NULL OR f.transport_type_id = p_transport_type_id)
    GROUP BY f.route_number, f.transport_type
  ) x
  WHERE rnk <= p_limit
  ORDER BY rnk, total_passengers DESC;
$$;


ALTER FUNCTION municipality_api.get_top_routes(p_from date, p_to date, p_transport_type_id integer, p_limit integer) OWNER TO ct_migrator;

--
-- Name: recalculate_route_stop_distances(bigint); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.recalculate_route_stop_distances(p_route_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_points_count integer;
    v_stops_count integer;
BEGIN
    SELECT count(*) INTO v_points_count FROM public.route_points WHERE route_id = p_route_id;
    SELECT count(*) INTO v_stops_count FROM public.route_stops WHERE route_id = p_route_id;

    IF v_points_count < 2 OR v_stops_count < 2 THEN RETURN; END IF;

    WITH RECURSIVE ordered_points AS (
        SELECT rp.id, rp.route_id, rp.lon, rp.lat, rp.prev_route_point_id, 1 AS sort_order
        FROM public.route_points rp
        WHERE rp.route_id = p_route_id AND rp.prev_route_point_id IS NULL
        UNION ALL
        SELECT next_p.id, next_p.route_id, next_p.lon, next_p.lat, next_p.prev_route_point_id, op.sort_order + 1
        FROM public.route_points next_p
        JOIN ordered_points op ON next_p.prev_route_point_id = op.id
    ),
    -- Step 1: Get previous point coordinates using LAG
    points_with_prev AS (
        SELECT id, route_id, lon, lat, sort_order,
               LAG(lon) OVER (ORDER BY sort_order) AS prev_lon,
               LAG(lat) OVER (ORDER BY sort_order) AS prev_lat
        FROM ordered_points
    ),
    -- Step 2: Calculate segment distance, then cumulative distance
    point_distances AS (
        SELECT id, route_id, lon, lat, sort_order,
               SUM(COALESCE(
                   ST_DistanceSphere(
                       ST_MakePoint(lon::double precision, lat::double precision),
                       ST_MakePoint(prev_lon::double precision, prev_lat::double precision)
                   ), 0
               )) OVER (ORDER BY sort_order) / 1000.0 AS distance_km
        FROM points_with_prev
    ),
    ordered_stops AS (
        SELECT rs.id, rs.stop_id, rs.prev_route_stop_id, rs.next_route_stop_id, 1 AS sort_order
        FROM public.route_stops rs
        WHERE rs.route_id = p_route_id AND rs.prev_route_stop_id IS NULL
        UNION ALL
        SELECT rs.id, rs.stop_id, rs.prev_route_stop_id, rs.next_route_stop_id, os.sort_order + 1
        FROM public.route_stops rs
        JOIN ordered_stops os ON rs.prev_route_stop_id = os.id
    ),
    stop_positions AS (
        SELECT os.id AS route_stop_id, os.next_route_stop_id, pd.sort_order AS point_order, pd.distance_km
        FROM ordered_stops os
        JOIN public.stops s ON s.id = os.stop_id
        JOIN LATERAL (
            SELECT sort_order, distance_km FROM point_distances pd
            ORDER BY ST_DistanceSphere(
                ST_MakePoint(s.lon::double precision, s.lat::double precision),
                ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
            ) LIMIT 1
        ) pd ON true
        WHERE os.prev_route_stop_id IS NULL
        UNION ALL
        SELECT os.id AS route_stop_id, os.next_route_stop_id,
               COALESCE(pd_next.sort_order, pd_any.sort_order) AS point_order,
               COALESCE(pd_next.distance_km, pd_any.distance_km) AS distance_km
        FROM ordered_stops os
        JOIN stop_positions sp ON os.prev_route_stop_id = sp.route_stop_id
        JOIN public.stops s ON s.id = os.stop_id
        LEFT JOIN LATERAL (
            SELECT sort_order, distance_km FROM point_distances pd
            WHERE pd.sort_order >= sp.point_order
            ORDER BY ST_DistanceSphere(
                ST_MakePoint(s.lon::double precision, s.lat::double precision),
                ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
            ) LIMIT 1
        ) pd_next ON true
        LEFT JOIN LATERAL (
            SELECT sort_order, distance_km FROM point_distances pd
            ORDER BY ST_DistanceSphere(
                ST_MakePoint(s.lon::double precision, s.lat::double precision),
                ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
            ) LIMIT 1
        ) pd_any ON true
    ),
    stop_distances AS (
        SELECT sp.route_stop_id, sp.next_route_stop_id,
               (next_sp.distance_km - sp.distance_km) AS distance_to_next_km
        FROM stop_positions sp
        LEFT JOIN stop_positions next_sp ON next_sp.route_stop_id = sp.next_route_stop_id
    )
    UPDATE public.route_stops rs
    SET distance_to_next_km = CASE
        WHEN sd.next_route_stop_id IS NULL THEN NULL
        ELSE GREATEST(sd.distance_to_next_km, 0)
    END
    FROM stop_distances sd WHERE rs.id = sd.route_stop_id;
END;
$$;


ALTER FUNCTION municipality_api.recalculate_route_stop_distances(p_route_id bigint) OWNER TO ct_migrator;

--
-- Name: set_route_active(bigint, boolean); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.set_route_active(p_route_id bigint, p_is_active boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    UPDATE public.routes SET is_active = p_is_active WHERE id = p_route_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Route not found'; END IF;
END;
$$;


ALTER FUNCTION municipality_api.set_route_active(p_route_id bigint, p_is_active boolean) OWNER TO ct_migrator;

--
-- Name: update_complaint_status(bigint, text); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.update_complaint_status(p_id bigint, p_status text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    IF p_status NOT IN ('Подано', 'Розглядається', 'Розглянуто') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;
    UPDATE public.complaints_suggestions SET status = p_status WHERE id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Complaint not found'; END IF;
END;
$$;


ALTER FUNCTION municipality_api.update_complaint_status(p_id bigint, p_status text) OWNER TO ct_migrator;

--
-- Name: update_stop(bigint, text, numeric, numeric); Type: FUNCTION; Schema: municipality_api; Owner: ct_migrator
--

CREATE FUNCTION municipality_api.update_stop(p_id bigint, p_name text, p_lon numeric, p_lat numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    UPDATE public.stops SET name = p_name, lon = p_lon, lat = p_lat WHERE id = p_id;
END;
$$;


ALTER FUNCTION municipality_api.update_stop(p_id bigint, p_name text, p_lon numeric, p_lat numeric) OWNER TO ct_migrator;

--
-- Name: buy_ticket(bigint, bigint, numeric); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_bal numeric; v_tid bigint; v_uid bigint;
BEGIN
    -- Validate price
    IF p_price <= 0 THEN
        RAISE EXCEPTION 'Price must be positive';
    END IF;

    -- Validate trip exists
    IF NOT EXISTS (SELECT 1 FROM public.trips WHERE id = p_trip_id) THEN
        RAISE EXCEPTION 'Trip not found';
    END IF;

    -- Lock the card row to prevent concurrent balance modifications
    SELECT user_id, balance INTO v_uid, v_bal
    FROM public.transport_cards
    WHERE id = p_card_id
    FOR UPDATE;

    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Card not found';
    END IF;

    IF (SELECT id FROM public.users WHERE login = session_user) != v_uid THEN
        RAISE EXCEPTION 'Not your card';
    END IF;

    IF v_bal < p_price THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    UPDATE public.transport_cards SET balance = balance - p_price WHERE id = p_card_id;
    INSERT INTO public.tickets (card_id, trip_id, price, purchased_at)
    VALUES (p_card_id, p_trip_id, p_price, now()) RETURNING id INTO v_tid;
    RETURN v_tid;
END;
$$;


ALTER FUNCTION passenger_api.buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric) OWNER TO ct_migrator;

--
-- Name: find_routes_between(numeric, numeric, numeric, numeric, integer); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.find_routes_between(p_start_lon numeric, p_start_lat numeric, p_end_lon numeric, p_end_lat numeric, p_radius_m integer DEFAULT 800) RETURNS TABLE(route_id bigint, route_number text, transport_type text, start_stop_name text, end_stop_name text)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT r.id, r.number, tt.name, s1.name, s2.name
    FROM public.routes r
    JOIN public.transport_types tt ON tt.id = r.transport_type_id
    JOIN public.route_stops rs1 ON rs1.route_id = r.id
    JOIN public.stops s1 ON s1.id = rs1.stop_id
    JOIN public.route_stops rs2 ON rs2.route_id = r.id
    JOIN public.stops s2 ON s2.id = rs2.stop_id
    WHERE ST_DWithin(
            ST_SetSRID(ST_MakePoint(s1.lon, s1.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_start_lon, p_start_lat), 4326)::geography, p_radius_m)
      AND ST_DWithin(
            ST_SetSRID(ST_MakePoint(s2.lon, s2.lat), 4326)::geography,
            ST_SetSRID(ST_MakePoint(p_end_lon, p_end_lat), 4326)::geography, p_radius_m)
      AND rs1.id < rs2.id;
END;
$$;


ALTER FUNCTION passenger_api.find_routes_between(p_start_lon numeric, p_start_lat numeric, p_end_lon numeric, p_end_lat numeric, p_radius_m integer) OWNER TO ct_migrator;

--
-- Name: find_stops_nearby(numeric, numeric, integer); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.find_stops_nearby(p_lon numeric, p_lat numeric, p_radius_m integer DEFAULT 1000) RETURNS TABLE(id bigint, name text, lon numeric, lat numeric, distance_m double precision)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
BEGIN
    RETURN QUERY
    SELECT s.id, s.name, s.lon, s.lat,
           ST_Distance(
               ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography,
               ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography
           ) AS distance_m
    FROM public.stops s
    WHERE ST_DWithin(
        ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326)::geography,
        ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326)::geography,
        p_radius_m
    )
    ORDER BY distance_m;
END;
$$;


ALTER FUNCTION passenger_api.find_stops_nearby(p_lon numeric, p_lat numeric, p_radius_m integer) OWNER TO ct_migrator;

--
-- Name: log_my_gps(numeric, numeric, timestamp without time zone); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.log_my_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone DEFAULT now()) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_user_id bigint;
    v_log_id bigint;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    -- Validate coordinates
    IF p_lon < -180 OR p_lon > 180 THEN
        RAISE EXCEPTION 'Invalid longitude: must be between -180 and 180';
    END IF;
    IF p_lat < -90 OR p_lat > 90 THEN
        RAISE EXCEPTION 'Invalid latitude: must be between -90 and 90';
    END IF;

    INSERT INTO public.user_gps_logs (user_id, lon, lat, recorded_at)
    VALUES (v_user_id, p_lon, p_lat, p_recorded_at)
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;


ALTER FUNCTION passenger_api.log_my_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone) OWNER TO ct_migrator;

--
-- Name: pay_fine(bigint, bigint); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.pay_fine(p_fine_id bigint, p_card_id bigint) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_user_id bigint;
    v_fine_user_id bigint;
    v_fine_amount numeric;
    v_fine_status text;
    v_card_user_id bigint;
    v_card_balance numeric;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Lock the fine row to prevent concurrent payment attempts
    SELECT user_id, amount, status INTO v_fine_user_id, v_fine_amount, v_fine_status
    FROM public.fines WHERE id = p_fine_id
    FOR UPDATE;

    IF v_fine_user_id IS NULL THEN RAISE EXCEPTION 'Fine not found'; END IF;
    IF v_fine_user_id != v_user_id THEN RAISE EXCEPTION 'Not your fine'; END IF;
    IF v_fine_status = 'Оплачено' THEN RAISE EXCEPTION 'Fine is already paid'; END IF;
    IF v_fine_status = 'Відмінено' THEN RAISE EXCEPTION 'Fine is cancelled'; END IF;

    -- Lock the card row to prevent concurrent balance modifications
    SELECT user_id, balance INTO v_card_user_id, v_card_balance
    FROM public.transport_cards WHERE id = p_card_id
    FOR UPDATE;

    IF v_card_user_id IS NULL THEN RAISE EXCEPTION 'Card not found'; END IF;
    IF v_card_user_id != v_user_id THEN RAISE EXCEPTION 'Not your card'; END IF;
    IF v_card_balance < v_fine_amount THEN RAISE EXCEPTION 'Insufficient balance on card'; END IF;

    UPDATE public.transport_cards SET balance = balance - v_fine_amount WHERE id = p_card_id;
    UPDATE public.fines SET status = 'Оплачено' WHERE id = p_fine_id;
END;
$$;


ALTER FUNCTION passenger_api.pay_fine(p_fine_id bigint, p_card_id bigint) OWNER TO ct_migrator;

--
-- Name: submit_complaint(text, text, text, text, text); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.submit_complaint(p_type text, p_message text, p_route_number text DEFAULT NULL::text, p_transport_type text DEFAULT NULL::text, p_vehicle_number text DEFAULT NULL::text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_user_id bigint;
    v_route_id INT;
    v_vehicle_id BIGINT;
    v_id bigint;
BEGIN
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Validate complaint type
    IF p_type NOT IN ('complaint', 'suggestion') THEN
        RAISE EXCEPTION 'Invalid type: %. Must be complaint or suggestion', p_type;
    END IF;

    -- Validate message length
    IF length(p_message) > 5000 THEN
        RAISE EXCEPTION 'Message too long (max 5000 characters)';
    END IF;

    -- Validate route if provided
    IF p_route_number IS NOT NULL AND p_transport_type IS NOT NULL THEN
        SELECT r.id INTO v_route_id
        FROM public.routes r
        JOIN public.transport_types tt ON tt.id = r.transport_type_id
        WHERE r.number = p_route_number AND tt.name = p_transport_type
        LIMIT 1;

        IF v_route_id IS NULL THEN
            RAISE EXCEPTION 'Route not found: % (%)', p_route_number, p_transport_type;
        END IF;
    END IF;

    -- Validate vehicle if provided
    IF p_vehicle_number IS NOT NULL THEN
        SELECT id INTO v_vehicle_id FROM public.vehicles WHERE fleet_number = p_vehicle_number LIMIT 1;

        IF v_vehicle_id IS NULL THEN
            RAISE EXCEPTION 'Vehicle not found: %', p_vehicle_number;
        END IF;
    END IF;

    INSERT INTO public.complaints_suggestions (user_id, type, message, status, created_at, route_id, vehicle_id)
    VALUES (v_user_id, p_type, p_message, 'Подано', now(), v_route_id, v_vehicle_id)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;


ALTER FUNCTION passenger_api.submit_complaint(p_type text, p_message text, p_route_number text, p_transport_type text, p_vehicle_number text) OWNER TO ct_migrator;

--
-- Name: submit_fine_appeal(bigint, text); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.submit_fine_appeal(p_fine_id bigint, p_message text) RETURNS bigint
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE
    v_user_id bigint;
    v_fine_user_id bigint;
    v_fine_status text;
    v_id bigint;
BEGIN
    -- Отримати ID поточного користувача
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;

    -- Отримати дані штрафу
    SELECT user_id, status INTO v_fine_user_id, v_fine_status
    FROM public.fines WHERE id = p_fine_id;

    -- Перевірка: штраф існує
    IF v_fine_user_id IS NULL THEN
        RAISE EXCEPTION 'Штраф не знайдено';
    END IF;

    -- Перевірка: це штраф поточного користувача
    IF v_fine_user_id != v_user_id THEN
        RAISE EXCEPTION 'Це не ваш штраф';
    END IF;

    -- Перевірка: статус дозволяє оскарження
    IF v_fine_status = 'В процесі' THEN
        RAISE EXCEPTION 'Апеляцію на цей штраф вже подано';
    END IF;
    IF v_fine_status = 'Оплачено' THEN
        RAISE EXCEPTION 'Оплачений штраф не можна оскаржити';
    END IF;
    IF v_fine_status = 'Відмінено' THEN
        RAISE EXCEPTION 'Штраф вже відмінено';
    END IF;

    -- Перевірка: апеляція ще не існує (додаткова перевірка перед UNIQUE constraint)
    IF EXISTS (SELECT 1 FROM public.fine_appeals WHERE fine_id = p_fine_id) THEN
        RAISE EXCEPTION 'Апеляцію на цей штраф вже подано раніше';
    END IF;

    -- Створити апеляцію
    INSERT INTO public.fine_appeals (fine_id, message, status, created_at)
    VALUES (p_fine_id, p_message, 'Подано', now())
    RETURNING id INTO v_id;

    -- Оновити статус штрафу на 'В процесі'
    UPDATE public.fines SET status = 'В процесі' WHERE id = p_fine_id;

    RETURN v_id;
END;
$$;


ALTER FUNCTION passenger_api.submit_fine_appeal(p_fine_id bigint, p_message text) OWNER TO ct_migrator;

--
-- Name: top_up_card(text, numeric); Type: FUNCTION; Schema: passenger_api; Owner: ct_migrator
--

CREATE FUNCTION passenger_api.top_up_card(p_card text, p_amt numeric) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
DECLARE v_cid bigint;
BEGIN
    -- Validate amount
    IF p_amt <= 0 THEN
        RAISE EXCEPTION 'Amount must be positive';
    END IF;

    -- Select card only if it belongs to current user
    SELECT tc.id INTO v_cid
    FROM public.transport_cards tc
    JOIN public.users u ON u.id = tc.user_id
    WHERE tc.card_number = p_card AND u.login = session_user;

    IF v_cid IS NULL THEN
        RAISE EXCEPTION 'Card not found or not yours';
    END IF;

    UPDATE public.transport_cards SET balance = balance + p_amt WHERE id = v_cid;
    INSERT INTO public.card_top_ups (card_id, amount, topped_up_at) VALUES (v_cid, p_amt, now());
END;
$$;


ALTER FUNCTION passenger_api.top_up_card(p_card text, p_amt numeric) OWNER TO ct_migrator;

--
-- Name: distance_km(numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: ct_migrator
--

CREATE FUNCTION public.distance_km(lon1 numeric, lat1 numeric, lon2 numeric, lat2 numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT COALESCE(ST_DistanceSphere(
    ST_MakePoint(lon1::float, lat1::float),
    ST_MakePoint(lon2::float, lat2::float)
  ) / 1000.0, 0)::numeric;
$$;


ALTER FUNCTION public.distance_km(lon1 numeric, lat1 numeric, lon2 numeric, lat2 numeric) OWNER TO ct_migrator;

--
-- Name: fn_update_vehicle_location(); Type: FUNCTION; Schema: public; Owner: ct_migrator
--

CREATE FUNCTION public.fn_update_vehicle_location() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE public.vehicles
    SET last_lon = NEW.lon, last_lat = NEW.lat, last_recorded_at = NEW.recorded_at
    WHERE id = NEW.vehicle_id;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.fn_update_vehicle_location() OWNER TO ct_migrator;

--
-- Name: format_minutes_to_time(numeric); Type: FUNCTION; Schema: public; Owner: ct_migrator
--

CREATE FUNCTION public.format_minutes_to_time(total_minutes numeric) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT LPAD((total_minutes::int / 60 % 24)::text, 2, '0') || ':' ||
         LPAD((total_minutes::int % 60)::text, 2, '0');
$$;


ALTER FUNCTION public.format_minutes_to_time(total_minutes numeric) OWNER TO ct_migrator;

--
-- Name: parse_time_to_minutes(time without time zone); Type: FUNCTION; Schema: public; Owner: ct_migrator
--

CREATE FUNCTION public.parse_time_to_minutes(time_val time without time zone) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT EXTRACT(HOUR FROM time_val) * 60 + EXTRACT(MINUTE FROM time_val);
$$;


ALTER FUNCTION public.parse_time_to_minutes(time_val time without time zone) OWNER TO ct_migrator;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: budgets; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.budgets (
    id bigint NOT NULL,
    month date NOT NULL,
    income numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    expenses numeric(14,2) DEFAULT '0'::numeric NOT NULL,
    note text,
    CONSTRAINT budgets_expenses_check CHECK ((expenses >= (0)::numeric)),
    CONSTRAINT budgets_income_check CHECK ((income >= (0)::numeric))
);


ALTER TABLE public.budgets OWNER TO ct_migrator;

--
-- Name: v_budgets; Type: VIEW; Schema: accountant_api; Owner: ct_migrator
--

CREATE VIEW accountant_api.v_budgets AS
 SELECT id,
    month,
    income AS planned_income,
    expenses AS planned_expenses,
    note
   FROM public.budgets
  ORDER BY month DESC;


ALTER VIEW accountant_api.v_budgets OWNER TO ct_migrator;

--
-- Name: drivers; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.drivers (
    id bigint NOT NULL,
    login text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    full_name text NOT NULL,
    driver_license_number text NOT NULL,
    license_categories jsonb DEFAULT '[]'::jsonb NOT NULL,
    passport_data jsonb NOT NULL
);


ALTER TABLE public.drivers OWNER TO ct_migrator;

--
-- Name: v_drivers_list; Type: VIEW; Schema: accountant_api; Owner: ct_migrator
--

CREATE VIEW accountant_api.v_drivers_list AS
 SELECT id,
    full_name,
    driver_license_number
   FROM public.drivers;


ALTER VIEW accountant_api.v_drivers_list OWNER TO ct_migrator;

--
-- Name: expenses; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.expenses (
    id bigint NOT NULL,
    category text NOT NULL,
    amount numeric(12,2) NOT NULL,
    description text,
    occurred_at timestamp without time zone DEFAULT now() NOT NULL,
    document_ref text,
    CONSTRAINT expenses_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.expenses OWNER TO ct_migrator;

--
-- Name: v_expenses; Type: VIEW; Schema: accountant_api; Owner: ct_migrator
--

CREATE VIEW accountant_api.v_expenses AS
 SELECT id,
    category,
    amount,
    description,
    occurred_at,
    document_ref
   FROM public.expenses
  ORDER BY occurred_at DESC;


ALTER VIEW accountant_api.v_expenses OWNER TO ct_migrator;

--
-- Name: fines; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.fines (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    status text NOT NULL,
    amount numeric(12,2) NOT NULL,
    reason text NOT NULL,
    issued_by text DEFAULT CURRENT_USER NOT NULL,
    trip_id bigint NOT NULL,
    issued_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT fines_amount_check CHECK ((amount > (0)::numeric)),
    CONSTRAINT fines_status_check CHECK ((status = ANY (ARRAY['Очікує сплати'::text, 'В процесі'::text, 'Оплачено'::text, 'Відмінено'::text, 'Прострочено'::text])))
);


ALTER TABLE public.fines OWNER TO ct_migrator;

--
-- Name: salary_payments; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.salary_payments (
    id bigint NOT NULL,
    driver_id bigint NOT NULL,
    rate numeric(12,2),
    units integer,
    total numeric(12,2) NOT NULL,
    paid_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT salary_payments_rate_check CHECK (((rate IS NULL) OR (rate > (0)::numeric))),
    CONSTRAINT salary_payments_total_check CHECK ((total > (0)::numeric)),
    CONSTRAINT salary_payments_units_check CHECK (((units IS NULL) OR (units > 0)))
);


ALTER TABLE public.salary_payments OWNER TO ct_migrator;

--
-- Name: tickets; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.tickets (
    id bigint NOT NULL,
    trip_id bigint NOT NULL,
    card_id bigint NOT NULL,
    price numeric(12,2) NOT NULL,
    purchased_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT tickets_price_check CHECK ((price >= (0)::numeric))
);


ALTER TABLE public.tickets OWNER TO ct_migrator;

--
-- Name: v_financial_report; Type: VIEW; Schema: accountant_api; Owner: ct_migrator
--

CREATE VIEW accountant_api.v_financial_report AS
 SELECT (t.purchased_at)::date AS report_date,
    'Квитки'::text AS category,
    COALESCE(sum(t.price), (0)::numeric) AS amount,
    'income'::text AS type
   FROM public.tickets t
  GROUP BY ((t.purchased_at)::date)
UNION ALL
 SELECT (f.issued_at)::date AS report_date,
    'Штрафи'::text AS category,
    COALESCE(sum(f.amount), (0)::numeric) AS amount,
    'income'::text AS type
   FROM public.fines f
  WHERE (f.status = 'Оплачено'::text)
  GROUP BY ((f.issued_at)::date)
UNION ALL
 SELECT (e.occurred_at)::date AS report_date,
    e.category,
    COALESCE(sum(e.amount), (0)::numeric) AS amount,
    'expense'::text AS type
   FROM public.expenses e
  GROUP BY ((e.occurred_at)::date), e.category
UNION ALL
 SELECT (sp.paid_at)::date AS report_date,
    'Зарплата'::text AS category,
    COALESCE(sum(sp.total), (0)::numeric) AS amount,
    'expense'::text AS type
   FROM public.salary_payments sp
  GROUP BY ((sp.paid_at)::date);


ALTER VIEW accountant_api.v_financial_report OWNER TO ct_migrator;

--
-- Name: v_salary_history; Type: VIEW; Schema: accountant_api; Owner: ct_migrator
--

CREATE VIEW accountant_api.v_salary_history AS
 SELECT sp.id,
    sp.paid_at,
    sp.driver_id,
    d.full_name AS driver_name,
    d.driver_license_number AS license_number,
    sp.rate,
    sp.units,
    sp.total
   FROM (public.salary_payments sp
     JOIN public.drivers d ON ((d.id = sp.driver_id)))
  ORDER BY sp.paid_at DESC;


ALTER VIEW accountant_api.v_salary_history OWNER TO ct_migrator;

--
-- Name: routes; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.routes (
    id bigint NOT NULL,
    transport_type_id bigint NOT NULL,
    number text NOT NULL,
    direction text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT routes_direction_check CHECK ((direction = ANY (ARRAY['forward'::text, 'reverse'::text])))
);


ALTER TABLE public.routes OWNER TO ct_migrator;

--
-- Name: transport_cards; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.transport_cards (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    balance numeric(12,2) DEFAULT '0'::numeric NOT NULL,
    card_number text NOT NULL,
    CONSTRAINT transport_cards_balance_check CHECK ((balance >= (0)::numeric))
);


ALTER TABLE public.transport_cards OWNER TO ct_migrator;

--
-- Name: transport_types; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.transport_types (
    id bigint NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.transport_types OWNER TO ct_migrator;

--
-- Name: trips; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.trips (
    id bigint NOT NULL,
    route_id bigint NOT NULL,
    driver_id bigint NOT NULL,
    planned_starts_at timestamp without time zone NOT NULL,
    planned_ends_at timestamp without time zone,
    actual_starts_at timestamp without time zone,
    actual_ends_at timestamp without time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    passenger_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT trips_actual_ends_after_starts_check CHECK (((actual_ends_at IS NULL) OR (actual_starts_at IS NULL) OR (actual_ends_at > actual_starts_at))),
    CONSTRAINT trips_passenger_count_check CHECK ((passenger_count >= 0)),
    CONSTRAINT trips_status_check CHECK ((status = ANY (ARRAY['scheduled'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])))
);


ALTER TABLE public.trips OWNER TO ct_migrator;

--
-- Name: users; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    login text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    full_name text NOT NULL,
    registered_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.users OWNER TO ct_migrator;

--
-- Name: v_card_details; Type: VIEW; Schema: controller_api; Owner: ct_migrator
--

CREATE VIEW controller_api.v_card_details AS
 SELECT tc.id,
    tc.card_number,
    tc.balance,
    tc.user_id,
    u.full_name AS user_full_name,
    ( SELECT t.purchased_at
           FROM public.tickets t
          WHERE (t.card_id = tc.id)
          ORDER BY t.purchased_at DESC
         LIMIT 1) AS last_usage_at,
    ( SELECT r.number
           FROM ((public.tickets t
             JOIN public.trips tr ON ((tr.id = t.trip_id)))
             JOIN public.routes r ON ((r.id = tr.route_id)))
          WHERE (t.card_id = tc.id)
          ORDER BY t.purchased_at DESC
         LIMIT 1) AS last_route_number,
    ( SELECT tt.name
           FROM (((public.tickets t
             JOIN public.trips tr ON ((tr.id = t.trip_id)))
             JOIN public.routes r ON ((r.id = tr.route_id)))
             JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
          WHERE (t.card_id = tc.id)
          ORDER BY t.purchased_at DESC
         LIMIT 1) AS last_transport_type
   FROM (public.transport_cards tc
     JOIN public.users u ON ((u.id = tc.user_id)));


ALTER VIEW controller_api.v_card_details OWNER TO ct_migrator;

--
-- Name: v_routes; Type: VIEW; Schema: controller_api; Owner: ct_migrator
--

CREATE VIEW controller_api.v_routes AS
 SELECT DISTINCT ON (r.number, tt.name) r.id,
    r.number,
    tt.name AS transport_type
   FROM (public.routes r
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE (r.is_active = true)
  ORDER BY r.number, tt.name, r.id;


ALTER VIEW controller_api.v_routes OWNER TO ct_migrator;

--
-- Name: vehicle_models; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.vehicle_models (
    id integer NOT NULL,
    name character varying(255) NOT NULL,
    type_id integer NOT NULL,
    capacity integer NOT NULL
);


ALTER TABLE public.vehicle_models OWNER TO ct_migrator;

--
-- Name: vehicles; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.vehicles (
    id bigint NOT NULL,
    fleet_number text NOT NULL,
    vehicle_model_id bigint,
    route_id bigint NOT NULL,
    last_lon numeric,
    last_lat numeric,
    last_recorded_at timestamp without time zone
);


ALTER TABLE public.vehicles OWNER TO ct_migrator;

--
-- Name: v_vehicles; Type: VIEW; Schema: controller_api; Owner: ct_migrator
--

CREATE VIEW controller_api.v_vehicles AS
 SELECT v.id,
    v.fleet_number,
    r.id AS route_id,
    r.number AS route_number,
    tt.name AS transport_type,
    vm.name AS model_name
   FROM (((public.vehicles v
     LEFT JOIN public.routes r ON ((r.id = v.route_id)))
     LEFT JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     LEFT JOIN public.vehicle_models vm ON ((vm.id = v.vehicle_model_id)));


ALTER VIEW controller_api.v_vehicles OWNER TO ct_migrator;

--
-- Name: driver_vehicle_assignments; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.driver_vehicle_assignments (
    id bigint NOT NULL,
    driver_id bigint NOT NULL,
    vehicle_id bigint NOT NULL,
    assigned_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.driver_vehicle_assignments OWNER TO ct_migrator;

--
-- Name: v_active_trip_deviations; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_active_trip_deviations AS
 SELECT trip_id,
    route_number,
    fleet_number,
    driver_name,
    planned_starts_at,
    actual_starts_at,
    delay_minutes
   FROM ( SELECT t.id AS trip_id,
            r.number AS route_number,
            v.fleet_number,
            d.full_name AS driver_name,
            t.planned_starts_at,
            t.actual_starts_at,
            dispatcher_api.calculate_delay(t.id) AS delay_minutes
           FROM ((((public.trips t
             JOIN public.routes r ON ((r.id = t.route_id)))
             JOIN public.drivers d ON ((d.id = t.driver_id)))
             LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
             LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
          WHERE (t.status = ANY (ARRAY['scheduled'::text, 'in_progress'::text]))) deviations
  WHERE (abs(delay_minutes) > 5);


ALTER VIEW dispatcher_api.v_active_trip_deviations OWNER TO ct_migrator;

--
-- Name: v_active_trips; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_active_trips AS
 SELECT t.id,
    r.number AS route_number,
    v.fleet_number,
    d.full_name,
    t.planned_starts_at,
    t.actual_starts_at,
    (EXTRACT(epoch FROM (t.actual_starts_at - t.planned_starts_at)) / (60)::numeric) AS start_delay_min
   FROM ((((public.trips t
     JOIN public.routes r ON ((r.id = t.route_id)))
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
  WHERE (t.status = 'in_progress'::text);


ALTER VIEW dispatcher_api.v_active_trips OWNER TO ct_migrator;

--
-- Name: v_assignments_history; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_assignments_history AS
 SELECT dva.id,
    dva.driver_id,
    d.full_name AS driver_name,
    d.login AS driver_login,
    d.phone AS driver_phone,
    dva.vehicle_id,
    v.fleet_number,
    v.route_id,
    r.number AS route_number,
    r.direction,
    tt.id AS transport_type_id,
    tt.name AS transport_type,
    dva.assigned_at
   FROM ((((public.driver_vehicle_assignments dva
     JOIN public.drivers d ON ((d.id = dva.driver_id)))
     JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
     LEFT JOIN public.routes r ON ((r.id = v.route_id)))
     LEFT JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)));


ALTER VIEW dispatcher_api.v_assignments_history OWNER TO ct_migrator;

--
-- Name: v_drivers_list; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_drivers_list AS
 SELECT id,
    full_name,
    login,
    phone,
    driver_license_number
   FROM public.drivers;


ALTER VIEW dispatcher_api.v_drivers_list OWNER TO ct_migrator;

--
-- Name: v_scheduled_trips_today; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_scheduled_trips_today AS
 SELECT t.id,
    r.number AS route_number,
    r.direction,
    v.fleet_number,
    d.full_name AS driver_name,
    t.planned_starts_at,
    t.planned_ends_at
   FROM ((((public.trips t
     JOIN public.routes r ON ((r.id = t.route_id)))
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
  WHERE ((t.status = 'scheduled'::text) AND ((t.planned_starts_at)::date = CURRENT_DATE))
  ORDER BY t.planned_starts_at;


ALTER VIEW dispatcher_api.v_scheduled_trips_today OWNER TO ct_migrator;

--
-- Name: schedules; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.schedules (
    id bigint NOT NULL,
    route_id bigint NOT NULL,
    vehicle_id bigint,
    work_start_time time without time zone NOT NULL,
    work_end_time time without time zone NOT NULL,
    interval_min integer NOT NULL,
    monday boolean DEFAULT false NOT NULL,
    tuesday boolean DEFAULT false NOT NULL,
    wednesday boolean DEFAULT false NOT NULL,
    thursday boolean DEFAULT false NOT NULL,
    friday boolean DEFAULT false NOT NULL,
    saturday boolean DEFAULT false NOT NULL,
    sunday boolean DEFAULT false NOT NULL,
    valid_from date,
    valid_to date,
    CONSTRAINT schedules_interval_check CHECK ((interval_min > 0)),
    CONSTRAINT schedules_time_check CHECK ((work_end_time > work_start_time))
);


ALTER TABLE public.schedules OWNER TO ct_migrator;

--
-- Name: v_schedules_list; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_schedules_list AS
 SELECT s.id,
    s.route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    s.work_start_time,
    s.work_end_time,
    s.interval_min,
    s.vehicle_id,
    v.fleet_number,
    s.monday,
    s.tuesday,
    s.wednesday,
    s.thursday,
    s.friday,
    s.saturday,
    s.sunday,
    s.valid_from,
    s.valid_to,
        CASE EXTRACT(dow FROM CURRENT_DATE)
            WHEN 0 THEN s.sunday
            WHEN 1 THEN s.monday
            WHEN 2 THEN s.tuesday
            WHEN 3 THEN s.wednesday
            WHEN 4 THEN s.thursday
            WHEN 5 THEN s.friday
            WHEN 6 THEN s.saturday
            ELSE NULL::boolean
        END AS is_active_today
   FROM (((public.schedules s
     JOIN public.routes r ON ((r.id = s.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     LEFT JOIN public.vehicles v ON ((v.id = s.vehicle_id)));


ALTER VIEW dispatcher_api.v_schedules_list OWNER TO ct_migrator;

--
-- Name: v_trips_list; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_trips_list AS
 SELECT t.id,
    t.route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    dva.vehicle_id,
    v.fleet_number,
    t.driver_id,
    d.full_name AS driver_name,
    d.login AS driver_login,
    t.planned_starts_at,
    t.planned_ends_at,
    t.actual_starts_at,
    t.actual_ends_at,
    t.status,
    t.passenger_count,
        CASE
            WHEN (t.actual_starts_at IS NOT NULL) THEN (EXTRACT(epoch FROM (t.actual_starts_at - t.planned_starts_at)) / (60)::numeric)
            ELSE NULL::numeric
        END AS start_delay_min
   FROM (((((public.trips t
     JOIN public.routes r ON ((r.id = t.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
  ORDER BY t.planned_starts_at DESC;


ALTER VIEW dispatcher_api.v_trips_list OWNER TO ct_migrator;

--
-- Name: v_vehicle_monitoring; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_vehicle_monitoring AS
 SELECT v.id,
    v.fleet_number,
    v.route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    v.last_lon,
    v.last_lat,
    v.last_recorded_at,
        CASE
            WHEN (v.last_recorded_at > (now() - '00:05:00'::interval)) THEN 'active'::text
            ELSE 'inactive'::text
        END AS status,
    d.full_name AS current_driver_name
   FROM (((((public.vehicles v
     JOIN public.routes r ON ((r.id = v.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.vehicle_id = v.id)))
     LEFT JOIN public.trips t ON (((t.driver_id = dva.driver_id) AND (t.status = 'in_progress'::text))))
     LEFT JOIN public.drivers d ON ((d.id = t.driver_id)));


ALTER VIEW dispatcher_api.v_vehicle_monitoring OWNER TO ct_migrator;

--
-- Name: v_vehicles_list; Type: VIEW; Schema: dispatcher_api; Owner: ct_migrator
--

CREATE VIEW dispatcher_api.v_vehicles_list AS
 SELECT v.id,
    v.fleet_number,
    v.route_id,
    r.number AS route_number,
    v.vehicle_model_id,
    vm.capacity
   FROM ((public.vehicles v
     LEFT JOIN public.routes r ON ((r.id = v.route_id)))
     LEFT JOIN public.vehicle_models vm ON ((vm.id = v.vehicle_model_id)));


ALTER VIEW dispatcher_api.v_vehicles_list OWNER TO ct_migrator;

--
-- Name: v_my_active_trip; Type: VIEW; Schema: driver_api; Owner: ct_migrator
--

CREATE VIEW driver_api.v_my_active_trip WITH (security_barrier='true') AS
 SELECT t.id,
    t.route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    dva.vehicle_id,
    v.fleet_number,
    t.planned_starts_at,
    t.actual_starts_at,
    t.passenger_count,
    (EXTRACT(epoch FROM (t.actual_starts_at - t.planned_starts_at)) / (60)::numeric) AS start_delay_min
   FROM (((((public.trips t
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     JOIN public.routes r ON ((r.id = t.route_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE ((d.login = SESSION_USER) AND (t.status = 'in_progress'::text))
 LIMIT 1;


ALTER VIEW driver_api.v_my_active_trip OWNER TO ct_migrator;

--
-- Name: v_my_assignments; Type: VIEW; Schema: driver_api; Owner: ct_migrator
--

CREATE VIEW driver_api.v_my_assignments WITH (security_barrier='true') AS
 SELECT dva.id AS assignment_id,
    dva.assigned_at,
    v.id AS vehicle_id,
    v.fleet_number,
    vm.name AS vehicle_model,
    vm.capacity AS vehicle_capacity,
    r.id AS route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type
   FROM (((((public.driver_vehicle_assignments dva
     JOIN public.drivers d ON ((d.id = dva.driver_id)))
     JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
     LEFT JOIN public.vehicle_models vm ON ((vm.id = v.vehicle_model_id)))
     LEFT JOIN public.routes r ON ((r.id = v.route_id)))
     LEFT JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE (d.login = SESSION_USER)
  ORDER BY dva.assigned_at DESC;


ALTER VIEW driver_api.v_my_assignments OWNER TO ct_migrator;

--
-- Name: v_my_schedule; Type: VIEW; Schema: driver_api; Owner: ct_migrator
--

CREATE VIEW driver_api.v_my_schedule WITH (security_barrier='true') AS
 SELECT t.id,
    t.planned_starts_at,
    t.planned_ends_at,
    t.actual_starts_at,
    t.actual_ends_at,
    t.passenger_count,
    t.route_id,
    r.number AS route_number,
    r.direction,
    r.transport_type_id,
    tt.name AS transport_type,
    dva.vehicle_id,
    v.fleet_number
   FROM (((((public.trips t
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     JOIN public.routes r ON ((r.id = t.route_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE (d.login = SESSION_USER)
  ORDER BY t.planned_starts_at;


ALTER VIEW driver_api.v_my_schedule OWNER TO ct_migrator;

--
-- Name: v_my_scheduled_trips; Type: VIEW; Schema: driver_api; Owner: ct_migrator
--

CREATE VIEW driver_api.v_my_scheduled_trips WITH (security_barrier='true') AS
 SELECT t.id,
    t.route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    dva.vehicle_id,
    v.fleet_number,
    t.planned_starts_at,
    t.planned_ends_at,
    t.status
   FROM (((((public.trips t
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     JOIN public.routes r ON ((r.id = t.route_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE ((d.login = SESSION_USER) AND (t.status = 'scheduled'::text) AND ((t.planned_starts_at)::date = CURRENT_DATE))
  ORDER BY t.planned_starts_at;


ALTER VIEW driver_api.v_my_scheduled_trips OWNER TO ct_migrator;

--
-- Name: v_my_today_schedule; Type: VIEW; Schema: driver_api; Owner: ct_migrator
--

CREATE VIEW driver_api.v_my_today_schedule WITH (security_barrier='true') AS
 SELECT t.id AS trip_id,
    v.fleet_number,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    t.planned_starts_at,
    t.planned_ends_at,
    t.status,
    true AS is_working_today
   FROM (((((public.trips t
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
     JOIN public.routes r ON ((r.id = t.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE ((d.login = SESSION_USER) AND ((t.planned_starts_at)::date = CURRENT_DATE) AND (t.status = ANY (ARRAY['scheduled'::text, 'in_progress'::text])))
  ORDER BY t.planned_starts_at;


ALTER VIEW driver_api.v_my_today_schedule OWNER TO ct_migrator;

--
-- Name: v_my_trips; Type: VIEW; Schema: driver_api; Owner: ct_migrator
--

CREATE VIEW driver_api.v_my_trips WITH (security_barrier='true') AS
 SELECT t.id,
    t.route_id,
    r.number AS route_number,
    r.direction,
    tt.name AS transport_type,
    dva.vehicle_id,
    v.fleet_number,
    t.planned_starts_at,
    t.planned_ends_at,
    t.actual_starts_at,
    t.actual_ends_at,
    t.status,
    t.passenger_count,
        CASE
            WHEN (t.actual_starts_at IS NOT NULL) THEN (EXTRACT(epoch FROM (t.actual_starts_at - t.planned_starts_at)) / (60)::numeric)
            ELSE NULL::numeric
        END AS start_delay_min
   FROM (((((public.trips t
     JOIN public.drivers d ON ((d.id = t.driver_id)))
     JOIN public.routes r ON ((r.id = t.route_id)))
     LEFT JOIN public.driver_vehicle_assignments dva ON ((dva.driver_id = t.driver_id)))
     LEFT JOIN public.vehicles v ON ((v.id = dva.vehicle_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE (d.login = SESSION_USER)
  ORDER BY t.planned_starts_at DESC;


ALTER VIEW driver_api.v_my_trips OWNER TO ct_migrator;

--
-- Name: v_profile; Type: VIEW; Schema: driver_api; Owner: ct_migrator
--

CREATE VIEW driver_api.v_profile WITH (security_barrier='true') AS
 SELECT id,
    login,
    full_name,
    email,
    phone,
    driver_license_number,
    license_categories
   FROM public.drivers
  WHERE (login = SESSION_USER);


ALTER VIEW driver_api.v_profile OWNER TO ct_migrator;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: ct_migrator
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


ALTER TABLE drizzle.__drizzle_migrations OWNER TO ct_migrator;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: ct_migrator
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNER TO ct_migrator;

--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: ct_migrator
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: route_points; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.route_points (
    id bigint NOT NULL,
    route_id bigint NOT NULL,
    lon numeric(10,7) NOT NULL,
    lat numeric(10,7) NOT NULL,
    prev_route_point_id bigint,
    next_route_point_id bigint,
    CONSTRAINT route_points_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric))),
    CONSTRAINT route_points_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)))
);


ALTER TABLE public.route_points OWNER TO ct_migrator;

--
-- Name: v_route_geometries; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_route_geometries AS
 WITH RECURSIVE ordered_points AS (
         SELECT rp.route_id,
            rp.id,
            (rp.lon)::double precision AS lon,
            (rp.lat)::double precision AS lat,
            1 AS sort_order
           FROM public.route_points rp
          WHERE (rp.prev_route_point_id IS NULL)
        UNION ALL
         SELECT next_p.route_id,
            next_p.id,
            (next_p.lon)::double precision AS lon,
            (next_p.lat)::double precision AS lat,
            (op_1.sort_order + 1)
           FROM (public.route_points next_p
             JOIN ordered_points op_1 ON ((next_p.prev_route_point_id = op_1.id)))
        )
 SELECT r.id AS route_id,
    r.number,
    tt.name AS transport_type,
    r.direction,
    r.transport_type_id,
    (public.st_asgeojson(public.st_makeline(public.st_setsrid(public.st_makepoint(op.lon, op.lat), 4326) ORDER BY op.sort_order)))::jsonb AS geometry
   FROM ((public.routes r
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     JOIN ordered_points op ON ((op.route_id = r.id)))
  WHERE (r.is_active = true)
  GROUP BY r.id, r.number, tt.name, r.direction, r.transport_type_id;


ALTER VIEW guest_api.v_route_geometries OWNER TO ct_migrator;

--
-- Name: v_route_points; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_route_points AS
 SELECT id,
    route_id,
    lon,
    lat,
    prev_route_point_id,
    next_route_point_id
   FROM public.route_points;


ALTER VIEW guest_api.v_route_points OWNER TO ct_migrator;

--
-- Name: v_route_points_ordered; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_route_points_ordered AS
 WITH RECURSIVE ordered AS (
         SELECT route_points.id,
            route_points.route_id,
            route_points.lon,
            route_points.lat,
            route_points.prev_route_point_id,
            route_points.next_route_point_id,
            1 AS sort_order
           FROM public.route_points
          WHERE (route_points.prev_route_point_id IS NULL)
        UNION ALL
         SELECT rp.id,
            rp.route_id,
            rp.lon,
            rp.lat,
            rp.prev_route_point_id,
            rp.next_route_point_id,
            (o.sort_order + 1)
           FROM (public.route_points rp
             JOIN ordered o ON ((rp.prev_route_point_id = o.id)))
        )
 SELECT id,
    route_id,
    lon,
    lat,
    prev_route_point_id,
    next_route_point_id,
    sort_order
   FROM ordered;


ALTER VIEW guest_api.v_route_points_ordered OWNER TO ct_migrator;

--
-- Name: route_stops; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.route_stops (
    id bigint NOT NULL,
    route_id bigint NOT NULL,
    stop_id bigint NOT NULL,
    prev_route_stop_id bigint,
    next_route_stop_id bigint,
    distance_to_next_km numeric(10,3),
    CONSTRAINT route_stops_distance_check CHECK ((distance_to_next_km >= (0)::numeric))
);


ALTER TABLE public.route_stops OWNER TO ct_migrator;

--
-- Name: stops; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.stops (
    id bigint NOT NULL,
    name text NOT NULL,
    lon numeric(10,7) NOT NULL,
    lat numeric(10,7) NOT NULL,
    CONSTRAINT stops_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric))),
    CONSTRAINT stops_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)))
);


ALTER TABLE public.stops OWNER TO ct_migrator;

--
-- Name: v_route_stops; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_route_stops AS
 SELECT rs.id,
    rs.route_id,
    rs.stop_id,
    s.name AS stop_name,
    s.lon,
    s.lat,
    rs.distance_to_next_km,
    rs.prev_route_stop_id,
    rs.next_route_stop_id
   FROM (public.route_stops rs
     JOIN public.stops s ON ((s.id = rs.stop_id)));


ALTER VIEW guest_api.v_route_stops OWNER TO ct_migrator;

--
-- Name: v_route_stops_ordered; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_route_stops_ordered AS
 WITH RECURSIVE ordered AS (
         SELECT rs.id,
            rs.route_id,
            rs.stop_id,
            rs.distance_to_next_km,
            rs.prev_route_stop_id,
            rs.next_route_stop_id,
            s.name AS stop_name,
            s.lon,
            s.lat,
            1 AS sort_order
           FROM (public.route_stops rs
             JOIN public.stops s ON ((s.id = rs.stop_id)))
          WHERE (rs.prev_route_stop_id IS NULL)
        UNION ALL
         SELECT rs.id,
            rs.route_id,
            rs.stop_id,
            rs.distance_to_next_km,
            rs.prev_route_stop_id,
            rs.next_route_stop_id,
            s.name,
            s.lon,
            s.lat,
            (o.sort_order + 1)
           FROM ((public.route_stops rs
             JOIN public.stops s ON ((s.id = rs.stop_id)))
             JOIN ordered o ON ((rs.prev_route_stop_id = o.id)))
        )
 SELECT id,
    route_id,
    stop_id,
    distance_to_next_km,
    prev_route_stop_id,
    next_route_stop_id,
    stop_name,
    lon,
    lat,
    sort_order
   FROM ordered;


ALTER VIEW guest_api.v_route_stops_ordered OWNER TO ct_migrator;

--
-- Name: v_routes; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_routes AS
 SELECT r.id,
    r.number,
    r.direction,
    r.transport_type_id,
    tt.name AS transport_type_name
   FROM (public.routes r
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE (r.is_active = true);


ALTER VIEW guest_api.v_routes OWNER TO ct_migrator;

--
-- Name: v_schedules; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_schedules AS
 SELECT route_id,
    work_start_time,
    work_end_time,
    interval_min,
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,
    valid_from,
    valid_to,
    vehicle_id
   FROM public.schedules;


ALTER VIEW guest_api.v_schedules OWNER TO ct_migrator;

--
-- Name: v_stop_geometries; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_stop_geometries AS
 SELECT id,
    name,
    (public.st_asgeojson(public.st_setsrid(public.st_makepoint((lon)::double precision, (lat)::double precision), 4326)))::jsonb AS geometry
   FROM public.stops s;


ALTER VIEW guest_api.v_stop_geometries OWNER TO ct_migrator;

--
-- Name: v_stops; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_stops AS
 SELECT id,
    name,
    lon,
    lat
   FROM public.stops;


ALTER VIEW guest_api.v_stops OWNER TO ct_migrator;

--
-- Name: v_transport_types; Type: VIEW; Schema: guest_api; Owner: ct_migrator
--

CREATE VIEW guest_api.v_transport_types AS
 SELECT id,
    name
   FROM public.transport_types;


ALTER VIEW guest_api.v_transport_types OWNER TO ct_migrator;

--
-- Name: v_drivers; Type: VIEW; Schema: manager_api; Owner: ct_migrator
--

CREATE VIEW manager_api.v_drivers AS
 SELECT id,
    login,
    email,
    phone,
    full_name,
    driver_license_number,
    license_categories,
    passport_data
   FROM public.drivers;


ALTER VIEW manager_api.v_drivers OWNER TO ct_migrator;

--
-- Name: v_staff_roles; Type: VIEW; Schema: manager_api; Owner: ct_migrator
--

CREATE VIEW manager_api.v_staff_roles AS
 SELECT unnest(ARRAY['dispatcher'::text, 'controller'::text, 'accountant'::text, 'municipality'::text]) AS role_name,
    unnest(ARRAY['Manages schedules and driver assignments'::text, 'Issues fines and validates tickets'::text, 'Manages finances, expenses, and salaries'::text, 'Manages routes, stops, and analyzes data'::text]) AS description;


ALTER VIEW manager_api.v_staff_roles OWNER TO ct_migrator;

--
-- Name: v_vehicle_models; Type: VIEW; Schema: manager_api; Owner: ct_migrator
--

CREATE VIEW manager_api.v_vehicle_models AS
 SELECT vm.id,
    vm.name,
    vm.capacity,
    vm.type_id,
    tt.name AS transport_type
   FROM (public.vehicle_models vm
     JOIN public.transport_types tt ON ((tt.id = vm.type_id)));


ALTER VIEW manager_api.v_vehicle_models OWNER TO ct_migrator;

--
-- Name: v_vehicles; Type: VIEW; Schema: manager_api; Owner: ct_migrator
--

CREATE VIEW manager_api.v_vehicles AS
 SELECT v.id,
    v.fleet_number,
    r.number AS route_number,
    tt.name AS transport_type,
    vm.name AS model_name,
    vm.capacity
   FROM (((public.vehicles v
     LEFT JOIN public.routes r ON ((r.id = v.route_id)))
     LEFT JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     LEFT JOIN public.vehicle_models vm ON ((vm.id = v.vehicle_model_id)));


ALTER VIEW manager_api.v_vehicles OWNER TO ct_migrator;

--
-- Name: complaints_suggestions; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.complaints_suggestions (
    id bigint NOT NULL,
    user_id bigint,
    type text NOT NULL,
    message text NOT NULL,
    trip_id bigint,
    route_id integer,
    vehicle_id bigint,
    contact_info text,
    status text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT complaints_suggestions_status_check CHECK ((status = ANY (ARRAY['Подано'::text, 'Розглядається'::text, 'Розглянуто'::text])))
);


ALTER TABLE public.complaints_suggestions OWNER TO ct_migrator;

--
-- Name: v_complaints_dashboard; Type: VIEW; Schema: municipality_api; Owner: ct_migrator
--

CREATE VIEW municipality_api.v_complaints_dashboard AS
 SELECT c.id,
    c.type,
    c.message,
    c.status,
    c.created_at,
    r.number AS route_number,
    tt.name AS transport_type,
    v.fleet_number,
    c.contact_info
   FROM (((public.complaints_suggestions c
     LEFT JOIN public.routes r ON ((r.id = c.route_id)))
     LEFT JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     LEFT JOIN public.vehicles v ON ((v.id = c.vehicle_id)))
  ORDER BY c.created_at DESC;


ALTER VIEW municipality_api.v_complaints_dashboard OWNER TO ct_migrator;

--
-- Name: v_passenger_flow_analytics; Type: VIEW; Schema: municipality_api; Owner: ct_migrator
--

CREATE VIEW municipality_api.v_passenger_flow_analytics AS
 SELECT (t.actual_starts_at)::date AS trip_date,
    r.number AS route_number,
    tt.name AS transport_type,
    (sum(t.passenger_count))::integer AS passenger_count
   FROM ((public.trips t
     JOIN public.routes r ON ((r.id = t.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE ((t.status = 'completed'::text) AND (t.actual_starts_at IS NOT NULL))
  GROUP BY ((t.actual_starts_at)::date), r.number, tt.name
  ORDER BY ((t.actual_starts_at)::date) DESC;


ALTER VIEW municipality_api.v_passenger_flow_analytics OWNER TO ct_migrator;

--
-- Name: v_routes; Type: VIEW; Schema: municipality_api; Owner: ct_migrator
--

CREATE VIEW municipality_api.v_routes AS
 SELECT r.id,
    r.number,
    r.direction,
    r.is_active,
    r.transport_type_id,
    tt.name AS transport_type
   FROM (public.routes r
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  ORDER BY r.number, r.direction;


ALTER VIEW municipality_api.v_routes OWNER TO ct_migrator;

--
-- Name: v_stops; Type: VIEW; Schema: municipality_api; Owner: ct_migrator
--

CREATE VIEW municipality_api.v_stops AS
 SELECT id,
    name,
    lon,
    lat
   FROM public.stops
  ORDER BY name;


ALTER VIEW municipality_api.v_stops OWNER TO ct_migrator;

--
-- Name: v_trip_passenger_fact; Type: VIEW; Schema: municipality_api; Owner: ct_migrator
--

CREATE VIEW municipality_api.v_trip_passenger_fact AS
 SELECT t.id AS trip_id,
    (t.actual_starts_at)::date AS trip_date,
    t.actual_starts_at AS trip_datetime,
    t.route_id,
    r.number AS route_number,
    r.transport_type_id,
    tt.name AS transport_type,
    COALESCE(t.passenger_count, 0) AS passenger_count,
    t.driver_id,
    v.fleet_number
   FROM ((((public.trips t
     JOIN public.routes r ON ((r.id = t.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     LEFT JOIN LATERAL ( SELECT dva.vehicle_id
           FROM public.driver_vehicle_assignments dva
          WHERE ((dva.driver_id = t.driver_id) AND (dva.assigned_at <= t.actual_starts_at))
          ORDER BY dva.assigned_at DESC
         LIMIT 1) last_dva ON (true))
     LEFT JOIN public.vehicles v ON ((v.id = last_dva.vehicle_id)))
  WHERE ((t.status = 'completed'::text) AND (t.actual_starts_at IS NOT NULL));


ALTER VIEW municipality_api.v_trip_passenger_fact OWNER TO ct_migrator;

--
-- Name: fine_appeals; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.fine_appeals (
    id bigint NOT NULL,
    fine_id bigint NOT NULL,
    message text NOT NULL,
    status text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT fine_appeals_status_check CHECK ((status = ANY (ARRAY['Подано'::text, 'Перевіряється'::text, 'Відхилено'::text, 'Прийнято'::text])))
);


ALTER TABLE public.fine_appeals OWNER TO ct_migrator;

--
-- Name: v_my_appeals; Type: VIEW; Schema: passenger_api; Owner: ct_migrator
--

CREATE VIEW passenger_api.v_my_appeals WITH (security_barrier='true') AS
 SELECT fa.id,
    fa.fine_id,
    fa.message,
    fa.status,
    fa.created_at
   FROM ((public.fine_appeals fa
     JOIN public.fines f ON ((f.id = fa.fine_id)))
     JOIN public.users u ON ((u.id = f.user_id)))
  WHERE (u.login = SESSION_USER);


ALTER VIEW passenger_api.v_my_appeals OWNER TO ct_migrator;

--
-- Name: card_top_ups; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.card_top_ups (
    id bigint NOT NULL,
    card_id bigint NOT NULL,
    amount numeric(12,2) NOT NULL,
    topped_up_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT card_top_ups_amount_check CHECK ((amount > (0)::numeric))
);


ALTER TABLE public.card_top_ups OWNER TO ct_migrator;

--
-- Name: v_my_cards; Type: VIEW; Schema: passenger_api; Owner: ct_migrator
--

CREATE VIEW passenger_api.v_my_cards WITH (security_barrier='true') AS
 SELECT tc.id,
    tc.card_number,
    tc.balance,
    ( SELECT max(card_top_ups.topped_up_at) AS max
           FROM public.card_top_ups
          WHERE (card_top_ups.card_id = tc.id)) AS last_top_up
   FROM (public.transport_cards tc
     JOIN public.users u ON ((u.id = tc.user_id)))
  WHERE (u.login = SESSION_USER);


ALTER VIEW passenger_api.v_my_cards OWNER TO ct_migrator;

--
-- Name: v_my_fines; Type: VIEW; Schema: passenger_api; Owner: ct_migrator
--

CREATE VIEW passenger_api.v_my_fines WITH (security_barrier='true') AS
 SELECT f.id,
    f.amount,
    f.reason,
    f.status,
    f.issued_at
   FROM (public.fines f
     JOIN public.users u ON ((u.id = f.user_id)))
  WHERE (u.login = SESSION_USER);


ALTER VIEW passenger_api.v_my_fines OWNER TO ct_migrator;

--
-- Name: user_gps_logs; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.user_gps_logs (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    lon numeric(10,7) NOT NULL,
    lat numeric(10,7) NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_gps_logs_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric))),
    CONSTRAINT user_gps_logs_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)))
);


ALTER TABLE public.user_gps_logs OWNER TO ct_migrator;

--
-- Name: v_my_gps_history; Type: VIEW; Schema: passenger_api; Owner: ct_migrator
--

CREATE VIEW passenger_api.v_my_gps_history WITH (security_barrier='true') AS
 SELECT ugl.id,
    ugl.lon,
    ugl.lat,
    ugl.recorded_at
   FROM (public.user_gps_logs ugl
     JOIN public.users u ON ((u.id = ugl.user_id)))
  WHERE (u.login = SESSION_USER)
  ORDER BY ugl.recorded_at DESC;


ALTER VIEW passenger_api.v_my_gps_history OWNER TO ct_migrator;

--
-- Name: v_my_profile; Type: VIEW; Schema: passenger_api; Owner: ct_migrator
--

CREATE VIEW passenger_api.v_my_profile WITH (security_barrier='true') AS
 SELECT id,
    login,
    full_name,
    email,
    phone,
    registered_at
   FROM public.users u
  WHERE (login = SESSION_USER);


ALTER VIEW passenger_api.v_my_profile OWNER TO ct_migrator;

--
-- Name: v_my_trips; Type: VIEW; Schema: passenger_api; Owner: ct_migrator
--

CREATE VIEW passenger_api.v_my_trips WITH (security_barrier='true') AS
 SELECT t.id AS ticket_id,
    t.purchased_at,
    t.price,
    r.number AS route_number,
    tt.name AS transport_type,
    COALESCE(tr.actual_starts_at, tr.planned_starts_at) AS starts_at
   FROM (((((public.tickets t
     JOIN public.transport_cards tc ON ((tc.id = t.card_id)))
     JOIN public.users u ON ((u.id = tc.user_id)))
     JOIN public.trips tr ON ((tr.id = t.trip_id)))
     JOIN public.routes r ON ((r.id = tr.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
  WHERE (u.login = SESSION_USER)
  ORDER BY t.purchased_at DESC;


ALTER VIEW passenger_api.v_my_trips OWNER TO ct_migrator;

--
-- Name: v_transport_at_stops; Type: VIEW; Schema: passenger_api; Owner: ct_migrator
--

CREATE VIEW passenger_api.v_transport_at_stops AS
 SELECT rs.stop_id,
    r.id AS route_id,
    r.number AS route_number,
    tt.name AS transport_type,
    sch.interval_min AS approximate_interval
   FROM (((public.route_stops rs
     JOIN public.routes r ON ((r.id = rs.route_id)))
     JOIN public.transport_types tt ON ((tt.id = r.transport_type_id)))
     LEFT JOIN public.schedules sch ON ((sch.route_id = r.id)))
  WHERE (r.is_active = true);


ALTER VIEW passenger_api.v_transport_at_stops OWNER TO ct_migrator;

--
-- Name: budgets_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.budgets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.budgets_id_seq OWNER TO ct_migrator;

--
-- Name: budgets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.budgets_id_seq OWNED BY public.budgets.id;


--
-- Name: card_top_ups_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.card_top_ups_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.card_top_ups_id_seq OWNER TO ct_migrator;

--
-- Name: card_top_ups_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.card_top_ups_id_seq OWNED BY public.card_top_ups.id;


--
-- Name: complaints_suggestions_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.complaints_suggestions_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.complaints_suggestions_id_seq OWNER TO ct_migrator;

--
-- Name: complaints_suggestions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.complaints_suggestions_id_seq OWNED BY public.complaints_suggestions.id;


--
-- Name: driver_vehicle_assignments_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.driver_vehicle_assignments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.driver_vehicle_assignments_id_seq OWNER TO ct_migrator;

--
-- Name: driver_vehicle_assignments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.driver_vehicle_assignments_id_seq OWNED BY public.driver_vehicle_assignments.id;


--
-- Name: drivers_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.drivers_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.drivers_id_seq OWNER TO ct_migrator;

--
-- Name: drivers_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.drivers_id_seq OWNED BY public.drivers.id;


--
-- Name: expenses_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.expenses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.expenses_id_seq OWNER TO ct_migrator;

--
-- Name: expenses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.expenses_id_seq OWNED BY public.expenses.id;


--
-- Name: fine_appeals_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.fine_appeals_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fine_appeals_id_seq OWNER TO ct_migrator;

--
-- Name: fine_appeals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.fine_appeals_id_seq OWNED BY public.fine_appeals.id;


--
-- Name: fines_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.fines_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.fines_id_seq OWNER TO ct_migrator;

--
-- Name: fines_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.fines_id_seq OWNED BY public.fines.id;


--
-- Name: route_points_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.route_points_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.route_points_id_seq OWNER TO ct_migrator;

--
-- Name: route_points_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.route_points_id_seq OWNED BY public.route_points.id;


--
-- Name: route_stops_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.route_stops_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.route_stops_id_seq OWNER TO ct_migrator;

--
-- Name: route_stops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.route_stops_id_seq OWNED BY public.route_stops.id;


--
-- Name: routes_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.routes_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.routes_id_seq OWNER TO ct_migrator;

--
-- Name: routes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.routes_id_seq OWNED BY public.routes.id;


--
-- Name: salary_payments_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.salary_payments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.salary_payments_id_seq OWNER TO ct_migrator;

--
-- Name: salary_payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.salary_payments_id_seq OWNED BY public.salary_payments.id;


--
-- Name: schedules_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.schedules_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.schedules_id_seq OWNER TO ct_migrator;

--
-- Name: schedules_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.schedules_id_seq OWNED BY public.schedules.id;


--
-- Name: stops_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.stops_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.stops_id_seq OWNER TO ct_migrator;

--
-- Name: stops_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.stops_id_seq OWNED BY public.stops.id;


--
-- Name: tickets_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.tickets_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tickets_id_seq OWNER TO ct_migrator;

--
-- Name: tickets_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.tickets_id_seq OWNED BY public.tickets.id;


--
-- Name: transport_cards_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.transport_cards_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_cards_id_seq OWNER TO ct_migrator;

--
-- Name: transport_cards_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.transport_cards_id_seq OWNED BY public.transport_cards.id;


--
-- Name: transport_types_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.transport_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transport_types_id_seq OWNER TO ct_migrator;

--
-- Name: transport_types_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.transport_types_id_seq OWNED BY public.transport_types.id;


--
-- Name: trips_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.trips_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.trips_id_seq OWNER TO ct_migrator;

--
-- Name: trips_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.trips_id_seq OWNED BY public.trips.id;


--
-- Name: user_gps_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.user_gps_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_gps_logs_id_seq OWNER TO ct_migrator;

--
-- Name: user_gps_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.user_gps_logs_id_seq OWNED BY public.user_gps_logs.id;


--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO ct_migrator;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: vehicle_gps_logs; Type: TABLE; Schema: public; Owner: ct_migrator
--

CREATE TABLE public.vehicle_gps_logs (
    id bigint NOT NULL,
    vehicle_id bigint NOT NULL,
    lon numeric(10,7) NOT NULL,
    lat numeric(10,7) NOT NULL,
    recorded_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT vehicle_gps_logs_lat_check CHECK (((lat >= ('-90'::integer)::numeric) AND (lat <= (90)::numeric))),
    CONSTRAINT vehicle_gps_logs_lon_check CHECK (((lon >= ('-180'::integer)::numeric) AND (lon <= (180)::numeric)))
);


ALTER TABLE public.vehicle_gps_logs OWNER TO ct_migrator;

--
-- Name: vehicle_gps_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.vehicle_gps_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_gps_logs_id_seq OWNER TO ct_migrator;

--
-- Name: vehicle_gps_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.vehicle_gps_logs_id_seq OWNED BY public.vehicle_gps_logs.id;


--
-- Name: vehicle_models_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.vehicle_models_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicle_models_id_seq OWNER TO ct_migrator;

--
-- Name: vehicle_models_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.vehicle_models_id_seq OWNED BY public.vehicle_models.id;


--
-- Name: vehicles_id_seq; Type: SEQUENCE; Schema: public; Owner: ct_migrator
--

CREATE SEQUENCE public.vehicles_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.vehicles_id_seq OWNER TO ct_migrator;

--
-- Name: vehicles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: ct_migrator
--

ALTER SEQUENCE public.vehicles_id_seq OWNED BY public.vehicles.id;


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: ct_migrator
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Name: budgets id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.budgets ALTER COLUMN id SET DEFAULT nextval('public.budgets_id_seq'::regclass);


--
-- Name: card_top_ups id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.card_top_ups ALTER COLUMN id SET DEFAULT nextval('public.card_top_ups_id_seq'::regclass);


--
-- Name: complaints_suggestions id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.complaints_suggestions ALTER COLUMN id SET DEFAULT nextval('public.complaints_suggestions_id_seq'::regclass);


--
-- Name: driver_vehicle_assignments id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.driver_vehicle_assignments ALTER COLUMN id SET DEFAULT nextval('public.driver_vehicle_assignments_id_seq'::regclass);


--
-- Name: drivers id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.drivers ALTER COLUMN id SET DEFAULT nextval('public.drivers_id_seq'::regclass);


--
-- Name: expenses id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.expenses ALTER COLUMN id SET DEFAULT nextval('public.expenses_id_seq'::regclass);


--
-- Name: fine_appeals id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fine_appeals ALTER COLUMN id SET DEFAULT nextval('public.fine_appeals_id_seq'::regclass);


--
-- Name: fines id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fines ALTER COLUMN id SET DEFAULT nextval('public.fines_id_seq'::regclass);


--
-- Name: route_points id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_points ALTER COLUMN id SET DEFAULT nextval('public.route_points_id_seq'::regclass);


--
-- Name: route_stops id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops ALTER COLUMN id SET DEFAULT nextval('public.route_stops_id_seq'::regclass);


--
-- Name: routes id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.routes ALTER COLUMN id SET DEFAULT nextval('public.routes_id_seq'::regclass);


--
-- Name: salary_payments id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.salary_payments ALTER COLUMN id SET DEFAULT nextval('public.salary_payments_id_seq'::regclass);


--
-- Name: schedules id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.schedules ALTER COLUMN id SET DEFAULT nextval('public.schedules_id_seq'::regclass);


--
-- Name: stops id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.stops ALTER COLUMN id SET DEFAULT nextval('public.stops_id_seq'::regclass);


--
-- Name: tickets id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.tickets ALTER COLUMN id SET DEFAULT nextval('public.tickets_id_seq'::regclass);


--
-- Name: transport_cards id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_cards ALTER COLUMN id SET DEFAULT nextval('public.transport_cards_id_seq'::regclass);


--
-- Name: transport_types id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_types ALTER COLUMN id SET DEFAULT nextval('public.transport_types_id_seq'::regclass);


--
-- Name: trips id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.trips ALTER COLUMN id SET DEFAULT nextval('public.trips_id_seq'::regclass);


--
-- Name: user_gps_logs id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.user_gps_logs ALTER COLUMN id SET DEFAULT nextval('public.user_gps_logs_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Name: vehicle_gps_logs id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicle_gps_logs ALTER COLUMN id SET DEFAULT nextval('public.vehicle_gps_logs_id_seq'::regclass);


--
-- Name: vehicle_models id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicle_models ALTER COLUMN id SET DEFAULT nextval('public.vehicle_models_id_seq'::regclass);


--
-- Name: vehicles id; Type: DEFAULT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicles ALTER COLUMN id SET DEFAULT nextval('public.vehicles_id_seq'::regclass);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: ct_migrator
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_month_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_month_unique UNIQUE (month);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: card_top_ups card_top_ups_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.card_top_ups
    ADD CONSTRAINT card_top_ups_pkey PRIMARY KEY (id);


--
-- Name: complaints_suggestions complaints_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.complaints_suggestions
    ADD CONSTRAINT complaints_suggestions_pkey PRIMARY KEY (id);


--
-- Name: driver_vehicle_assignments driver_vehicle_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.driver_vehicle_assignments
    ADD CONSTRAINT driver_vehicle_assignments_pkey PRIMARY KEY (id);


--
-- Name: driver_vehicle_assignments driver_vehicle_assignments_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.driver_vehicle_assignments
    ADD CONSTRAINT driver_vehicle_assignments_unique UNIQUE (driver_id, vehicle_id, assigned_at);


--
-- Name: drivers drivers_driver_license_number_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_driver_license_number_unique UNIQUE (driver_license_number);


--
-- Name: drivers drivers_email_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_email_unique UNIQUE (email);


--
-- Name: drivers drivers_login_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_login_unique UNIQUE (login);


--
-- Name: drivers drivers_phone_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_phone_unique UNIQUE (phone);


--
-- Name: drivers drivers_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.drivers
    ADD CONSTRAINT drivers_pkey PRIMARY KEY (id);


--
-- Name: expenses expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.expenses
    ADD CONSTRAINT expenses_pkey PRIMARY KEY (id);


--
-- Name: fine_appeals fine_appeals_fine_id_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fine_appeals
    ADD CONSTRAINT fine_appeals_fine_id_unique UNIQUE (fine_id);


--
-- Name: fine_appeals fine_appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fine_appeals
    ADD CONSTRAINT fine_appeals_pkey PRIMARY KEY (id);


--
-- Name: fines fines_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fines
    ADD CONSTRAINT fines_pkey PRIMARY KEY (id);


--
-- Name: route_points route_points_next_route_point_id_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_points
    ADD CONSTRAINT route_points_next_route_point_id_unique UNIQUE (next_route_point_id);


--
-- Name: route_points route_points_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_points
    ADD CONSTRAINT route_points_pkey PRIMARY KEY (id);


--
-- Name: route_points route_points_prev_route_point_id_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_points
    ADD CONSTRAINT route_points_prev_route_point_id_unique UNIQUE (prev_route_point_id);


--
-- Name: route_stops route_stops_next_route_stop_id_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_next_route_stop_id_unique UNIQUE (next_route_stop_id);


--
-- Name: route_stops route_stops_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_pkey PRIMARY KEY (id);


--
-- Name: route_stops route_stops_prev_route_stop_id_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_prev_route_stop_id_unique UNIQUE (prev_route_stop_id);


--
-- Name: route_stops route_stops_route_stop_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_route_stop_unique UNIQUE (route_id, stop_id);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: routes routes_transport_type_number_direction_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_transport_type_number_direction_unique UNIQUE (transport_type_id, number, direction);


--
-- Name: salary_payments salary_payments_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.salary_payments
    ADD CONSTRAINT salary_payments_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_pkey PRIMARY KEY (id);


--
-- Name: schedules schedules_route_vehicle_period_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_route_vehicle_period_unique UNIQUE (route_id, vehicle_id, valid_from);


--
-- Name: stops stops_name_lon_lat_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.stops
    ADD CONSTRAINT stops_name_lon_lat_unique UNIQUE (name, lon, lat);


--
-- Name: stops stops_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.stops
    ADD CONSTRAINT stops_pkey PRIMARY KEY (id);


--
-- Name: tickets tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);


--
-- Name: transport_cards transport_cards_card_number_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_cards
    ADD CONSTRAINT transport_cards_card_number_unique UNIQUE (card_number);


--
-- Name: transport_cards transport_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_cards
    ADD CONSTRAINT transport_cards_pkey PRIMARY KEY (id);


--
-- Name: transport_cards transport_cards_user_id_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_cards
    ADD CONSTRAINT transport_cards_user_id_unique UNIQUE (user_id);


--
-- Name: transport_types transport_types_name_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_types
    ADD CONSTRAINT transport_types_name_unique UNIQUE (name);


--
-- Name: transport_types transport_types_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_types
    ADD CONSTRAINT transport_types_pkey PRIMARY KEY (id);


--
-- Name: trips trips_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_pkey PRIMARY KEY (id);


--
-- Name: user_gps_logs user_gps_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.user_gps_logs
    ADD CONSTRAINT user_gps_logs_pkey PRIMARY KEY (id);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_login_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_login_unique UNIQUE (login);


--
-- Name: users users_phone_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_unique UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vehicle_gps_logs vehicle_gps_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicle_gps_logs
    ADD CONSTRAINT vehicle_gps_logs_pkey PRIMARY KEY (id);


--
-- Name: vehicle_models vehicle_models_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicle_models
    ADD CONSTRAINT vehicle_models_pkey PRIMARY KEY (id);


--
-- Name: vehicles vehicles_fleet_number_unique; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_fleet_number_unique UNIQUE (fleet_number);


--
-- Name: vehicles vehicles_pkey; Type: CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);


--
-- Name: idx_dva_driver_assigned; Type: INDEX; Schema: public; Owner: ct_migrator
--

CREATE INDEX idx_dva_driver_assigned ON public.driver_vehicle_assignments USING btree (driver_id, assigned_at DESC);


--
-- Name: idx_stops_name_trgm; Type: INDEX; Schema: public; Owner: ct_migrator
--

CREATE INDEX idx_stops_name_trgm ON public.stops USING gin (name public.gin_trgm_ops);


--
-- Name: idx_trips_route_id; Type: INDEX; Schema: public; Owner: ct_migrator
--

CREATE INDEX idx_trips_route_id ON public.trips USING btree (route_id);


--
-- Name: idx_trips_status_actual_starts; Type: INDEX; Schema: public; Owner: ct_migrator
--

CREATE INDEX idx_trips_status_actual_starts ON public.trips USING btree (status, actual_starts_at) WHERE ((status = 'completed'::text) AND (actual_starts_at IS NOT NULL));


--
-- Name: trips_active_driver_unique; Type: INDEX; Schema: public; Owner: ct_migrator
--

CREATE UNIQUE INDEX trips_active_driver_unique ON public.trips USING btree (driver_id) WHERE (status = 'in_progress'::text);


--
-- Name: vehicle_gps_logs trg_update_vehicle_location; Type: TRIGGER; Schema: public; Owner: ct_migrator
--

CREATE TRIGGER trg_update_vehicle_location AFTER INSERT ON public.vehicle_gps_logs FOR EACH ROW EXECUTE FUNCTION public.fn_update_vehicle_location();


--
-- Name: card_top_ups card_top_ups_card_id_transport_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.card_top_ups
    ADD CONSTRAINT card_top_ups_card_id_transport_cards_id_fk FOREIGN KEY (card_id) REFERENCES public.transport_cards(id);


--
-- Name: complaints_suggestions complaints_suggestions_route_id_routes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.complaints_suggestions
    ADD CONSTRAINT complaints_suggestions_route_id_routes_id_fk FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: complaints_suggestions complaints_suggestions_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.complaints_suggestions
    ADD CONSTRAINT complaints_suggestions_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: complaints_suggestions complaints_suggestions_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.complaints_suggestions
    ADD CONSTRAINT complaints_suggestions_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: complaints_suggestions complaints_suggestions_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.complaints_suggestions
    ADD CONSTRAINT complaints_suggestions_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: driver_vehicle_assignments driver_vehicle_assignments_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.driver_vehicle_assignments
    ADD CONSTRAINT driver_vehicle_assignments_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE CASCADE;


--
-- Name: driver_vehicle_assignments driver_vehicle_assignments_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.driver_vehicle_assignments
    ADD CONSTRAINT driver_vehicle_assignments_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: fine_appeals fine_appeals_fine_id_fines_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fine_appeals
    ADD CONSTRAINT fine_appeals_fine_id_fines_id_fk FOREIGN KEY (fine_id) REFERENCES public.fines(id) ON DELETE CASCADE;


--
-- Name: fines fines_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fines
    ADD CONSTRAINT fines_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: fines fines_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.fines
    ADD CONSTRAINT fines_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: route_points route_points_next_route_point_id_route_points_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_points
    ADD CONSTRAINT route_points_next_route_point_id_route_points_id_fk FOREIGN KEY (next_route_point_id) REFERENCES public.route_points(id) ON DELETE SET NULL;


--
-- Name: route_points route_points_prev_route_point_id_route_points_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_points
    ADD CONSTRAINT route_points_prev_route_point_id_route_points_id_fk FOREIGN KEY (prev_route_point_id) REFERENCES public.route_points(id) ON DELETE SET NULL;


--
-- Name: route_points route_points_route_id_routes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_points
    ADD CONSTRAINT route_points_route_id_routes_id_fk FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;


--
-- Name: route_stops route_stops_next_route_stop_id_route_stops_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_next_route_stop_id_route_stops_id_fk FOREIGN KEY (next_route_stop_id) REFERENCES public.route_stops(id) ON DELETE SET NULL;


--
-- Name: route_stops route_stops_prev_route_stop_id_route_stops_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_prev_route_stop_id_route_stops_id_fk FOREIGN KEY (prev_route_stop_id) REFERENCES public.route_stops(id) ON DELETE SET NULL;


--
-- Name: route_stops route_stops_route_id_routes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_route_id_routes_id_fk FOREIGN KEY (route_id) REFERENCES public.routes(id) ON DELETE CASCADE;


--
-- Name: route_stops route_stops_stop_id_stops_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.route_stops
    ADD CONSTRAINT route_stops_stop_id_stops_id_fk FOREIGN KEY (stop_id) REFERENCES public.stops(id);


--
-- Name: routes routes_transport_type_id_transport_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_transport_type_id_transport_types_id_fk FOREIGN KEY (transport_type_id) REFERENCES public.transport_types(id);


--
-- Name: salary_payments salary_payments_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.salary_payments
    ADD CONSTRAINT salary_payments_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: salary_payments salary_payments_driver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.salary_payments
    ADD CONSTRAINT salary_payments_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: schedules schedules_route_id_routes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_route_id_routes_id_fk FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: schedules schedules_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.schedules
    ADD CONSTRAINT schedules_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id);


--
-- Name: tickets tickets_card_id_transport_cards_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_card_id_transport_cards_id_fk FOREIGN KEY (card_id) REFERENCES public.transport_cards(id);


--
-- Name: tickets tickets_trip_id_trips_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.tickets
    ADD CONSTRAINT tickets_trip_id_trips_id_fk FOREIGN KEY (trip_id) REFERENCES public.trips(id);


--
-- Name: transport_cards transport_cards_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.transport_cards
    ADD CONSTRAINT transport_cards_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: trips trips_driver_id_drivers_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_driver_id_drivers_id_fk FOREIGN KEY (driver_id) REFERENCES public.drivers(id);


--
-- Name: trips trips_route_id_routes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.trips
    ADD CONSTRAINT trips_route_id_routes_id_fk FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: user_gps_logs user_gps_logs_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.user_gps_logs
    ADD CONSTRAINT user_gps_logs_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: vehicle_gps_logs vehicle_gps_logs_vehicle_id_vehicles_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicle_gps_logs
    ADD CONSTRAINT vehicle_gps_logs_vehicle_id_vehicles_id_fk FOREIGN KEY (vehicle_id) REFERENCES public.vehicles(id) ON DELETE CASCADE;


--
-- Name: vehicle_models vehicle_models_type_id_transport_types_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicle_models
    ADD CONSTRAINT vehicle_models_type_id_transport_types_id_fk FOREIGN KEY (type_id) REFERENCES public.transport_types(id);


--
-- Name: vehicles vehicles_route_id_routes_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_route_id_routes_id_fk FOREIGN KEY (route_id) REFERENCES public.routes(id);


--
-- Name: vehicles vehicles_vehicle_model_id_vehicle_models_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: ct_migrator
--

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_vehicle_model_id_vehicle_models_id_fk FOREIGN KEY (vehicle_model_id) REFERENCES public.vehicle_models(id);


--
-- Name: card_top_ups; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.card_top_ups ENABLE ROW LEVEL SECURITY;

--
-- Name: complaints_suggestions; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.complaints_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: user_gps_logs dispatcher_user_gps_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY dispatcher_user_gps_select ON public.user_gps_logs FOR SELECT TO ct_dispatcher_role USING (true);


--
-- Name: trips driver_trips_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY driver_trips_select ON public.trips FOR SELECT TO ct_driver_role USING ((driver_id = ( SELECT drivers.id
   FROM public.drivers
  WHERE (drivers.login = SESSION_USER))));


--
-- Name: fine_appeals; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.fine_appeals ENABLE ROW LEVEL SECURITY;

--
-- Name: fines; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;

--
-- Name: complaints_suggestions municipality_complaints_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY municipality_complaints_select ON public.complaints_suggestions FOR SELECT TO ct_municipality_role USING (true);


--
-- Name: fine_appeals passenger_appeals_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_appeals_select ON public.fine_appeals FOR SELECT TO ct_passenger_role USING ((fine_id IN ( SELECT fines.id
   FROM public.fines
  WHERE (fines.user_id = ( SELECT users.id
           FROM public.users
          WHERE (users.login = SESSION_USER))))));


--
-- Name: transport_cards passenger_cards_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_cards_select ON public.transport_cards FOR SELECT TO ct_passenger_role USING ((user_id = ( SELECT users.id
   FROM public.users
  WHERE (users.login = SESSION_USER))));


--
-- Name: complaints_suggestions passenger_complaints_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_complaints_select ON public.complaints_suggestions FOR SELECT TO ct_passenger_role USING ((user_id = ( SELECT users.id
   FROM public.users
  WHERE (users.login = SESSION_USER))));


--
-- Name: fines passenger_fines_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_fines_select ON public.fines FOR SELECT TO ct_passenger_role USING ((user_id = ( SELECT users.id
   FROM public.users
  WHERE (users.login = SESSION_USER))));


--
-- Name: user_gps_logs passenger_gps_insert; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_gps_insert ON public.user_gps_logs FOR INSERT TO ct_passenger_role WITH CHECK ((user_id = ( SELECT users.id
   FROM public.users
  WHERE (users.login = SESSION_USER))));


--
-- Name: user_gps_logs passenger_gps_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_gps_select ON public.user_gps_logs FOR SELECT TO ct_passenger_role USING ((user_id = ( SELECT users.id
   FROM public.users
  WHERE (users.login = SESSION_USER))));


--
-- Name: tickets passenger_tickets_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_tickets_select ON public.tickets FOR SELECT TO ct_passenger_role USING ((EXISTS ( SELECT 1
   FROM public.transport_cards tc
  WHERE ((tc.id = tickets.card_id) AND (tc.user_id = ( SELECT users.id
           FROM public.users
          WHERE (users.login = SESSION_USER)))))));


--
-- Name: card_top_ups passenger_topups_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY passenger_topups_select ON public.card_top_ups FOR SELECT TO ct_passenger_role USING ((EXISTS ( SELECT 1
   FROM public.transport_cards tc
  WHERE ((tc.id = card_top_ups.card_id) AND (tc.user_id = ( SELECT users.id
           FROM public.users
          WHERE (users.login = SESSION_USER)))))));


--
-- Name: fine_appeals staff_appeals_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY staff_appeals_select ON public.fine_appeals FOR SELECT TO ct_accountant_role, ct_controller_role USING (true);


--
-- Name: transport_cards staff_cards_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY staff_cards_select ON public.transport_cards FOR SELECT TO ct_dispatcher_role, ct_controller_role USING (true);


--
-- Name: fines staff_fines_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY staff_fines_select ON public.fines FOR SELECT TO ct_accountant_role, ct_controller_role USING (true);


--
-- Name: tickets staff_tickets_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY staff_tickets_select ON public.tickets FOR SELECT TO ct_accountant_role, ct_controller_role USING (true);


--
-- Name: card_top_ups staff_topups_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY staff_topups_select ON public.card_top_ups FOR SELECT TO ct_accountant_role USING (true);


--
-- Name: trips staff_trips_select; Type: POLICY; Schema: public; Owner: ct_migrator
--

CREATE POLICY staff_trips_select ON public.trips FOR SELECT TO ct_dispatcher_role USING (true);


--
-- Name: tickets; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: transport_cards; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.transport_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: trips; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

--
-- Name: user_gps_logs; Type: ROW SECURITY; Schema: public; Owner: ct_migrator
--

ALTER TABLE public.user_gps_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA accountant_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA accountant_api TO ct_accountant_role;


--
-- Name: SCHEMA auth; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA auth TO ct_guest_role;
GRANT USAGE ON SCHEMA auth TO ct_passenger_role;


--
-- Name: SCHEMA controller_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA controller_api TO ct_controller_role;


--
-- Name: SCHEMA dispatcher_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA dispatcher_api TO ct_dispatcher_role;


--
-- Name: SCHEMA driver_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA driver_api TO ct_driver_role;


--
-- Name: SCHEMA guest_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA guest_api TO ct_guest_role;
GRANT USAGE ON SCHEMA guest_api TO ct_passenger_role;
GRANT USAGE ON SCHEMA guest_api TO ct_driver_role;
GRANT USAGE ON SCHEMA guest_api TO ct_dispatcher_role;
GRANT USAGE ON SCHEMA guest_api TO ct_municipality_role;
GRANT USAGE ON SCHEMA guest_api TO ct_controller_role;
GRANT USAGE ON SCHEMA guest_api TO ct_manager_role;


--
-- Name: SCHEMA manager_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA manager_api TO ct_manager_role;


--
-- Name: SCHEMA municipality_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA municipality_api TO ct_municipality_role;


--
-- Name: SCHEMA passenger_api; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA passenger_api TO ct_passenger_role;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: ct_migrator
--

GRANT USAGE ON SCHEMA public TO ct_accountant_role;
GRANT USAGE ON SCHEMA public TO ct_dispatcher_role;
GRANT USAGE ON SCHEMA public TO ct_controller_role;
GRANT USAGE ON SCHEMA public TO ct_driver_role;
GRANT USAGE ON SCHEMA public TO ct_passenger_role;
GRANT USAGE ON SCHEMA public TO ct_guest_role;
GRANT USAGE ON SCHEMA public TO ct_manager_role;
GRANT USAGE ON SCHEMA public TO ct_municipality_role;


--
-- Name: FUNCTION add_expense(p_category text, p_amount numeric, p_description text, p_document_ref text, p_occurred_at timestamp without time zone); Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION accountant_api.add_expense(p_category text, p_amount numeric, p_description text, p_document_ref text, p_occurred_at timestamp without time zone) TO ct_accountant_role;


--
-- Name: FUNCTION calculate_driver_salary(p_driver_id bigint, p_month date); Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION accountant_api.calculate_driver_salary(p_driver_id bigint, p_month date) TO ct_accountant_role;


--
-- Name: FUNCTION get_financial_report(p_start_date date, p_end_date date); Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION accountant_api.get_financial_report(p_start_date date, p_end_date date) TO ct_accountant_role;


--
-- Name: FUNCTION pay_salary(p_driver_id bigint, p_rate numeric, p_units integer, p_total numeric); Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION accountant_api.pay_salary(p_driver_id bigint, p_rate numeric, p_units integer, p_total numeric) TO ct_accountant_role;


--
-- Name: FUNCTION upsert_budget(p_month date, p_income numeric, p_expenses numeric, p_note text); Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION accountant_api.upsert_budget(p_month date, p_income numeric, p_expenses numeric, p_note text) TO ct_accountant_role;


--
-- Name: FUNCTION register_passenger(p_login text, p_password text, p_email text, p_phone text, p_full_name text); Type: ACL; Schema: auth; Owner: ct_migrator
--

REVOKE ALL ON FUNCTION auth.register_passenger(p_login text, p_password text, p_email text, p_phone text, p_full_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION auth.register_passenger(p_login text, p_password text, p_email text, p_phone text, p_full_name text) TO ct_guest_role;


--
-- Name: FUNCTION get_active_trips(p_fleet_number text, p_checked_at timestamp without time zone); Type: ACL; Schema: controller_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION controller_api.get_active_trips(p_fleet_number text, p_checked_at timestamp without time zone) TO ct_controller_role;


--
-- Name: FUNCTION issue_fine(p_card text, p_amt numeric, p_reason text, p_fleet text, p_time timestamp without time zone, p_trip_id bigint); Type: ACL; Schema: controller_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION controller_api.issue_fine(p_card text, p_amt numeric, p_reason text, p_fleet text, p_time timestamp without time zone, p_trip_id bigint) TO ct_controller_role;


--
-- Name: FUNCTION assign_driver_v2(p_driver_id bigint, p_fleet_number text); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.assign_driver_v2(p_driver_id bigint, p_fleet_number text) TO ct_dispatcher_role;


--
-- Name: FUNCTION calculate_delay(p_trip_id bigint); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.calculate_delay(p_trip_id bigint) TO ct_dispatcher_role;


--
-- Name: FUNCTION cancel_trip(p_trip_id bigint); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.cancel_trip(p_trip_id bigint) TO ct_dispatcher_role;


--
-- Name: FUNCTION create_schedule(p_route_id bigint, p_vehicle_id bigint, p_start time without time zone, p_end time without time zone, p_interval integer, p_monday boolean, p_tuesday boolean, p_wednesday boolean, p_thursday boolean, p_friday boolean, p_saturday boolean, p_sunday boolean, p_valid_from date, p_valid_to date); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.create_schedule(p_route_id bigint, p_vehicle_id bigint, p_start time without time zone, p_end time without time zone, p_interval integer, p_monday boolean, p_tuesday boolean, p_wednesday boolean, p_thursday boolean, p_friday boolean, p_saturday boolean, p_sunday boolean, p_valid_from date, p_valid_to date) TO ct_dispatcher_role;


--
-- Name: FUNCTION create_trip(p_route_id bigint, p_driver_id bigint, p_planned_starts_at timestamp without time zone, p_planned_ends_at timestamp without time zone); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.create_trip(p_route_id bigint, p_driver_id bigint, p_planned_starts_at timestamp without time zone, p_planned_ends_at timestamp without time zone) TO ct_dispatcher_role;


--
-- Name: FUNCTION delete_schedule(p_schedule_id bigint); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.delete_schedule(p_schedule_id bigint) TO ct_dispatcher_role;


--
-- Name: FUNCTION delete_trip(p_trip_id bigint); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.delete_trip(p_trip_id bigint) TO ct_dispatcher_role;


--
-- Name: FUNCTION generate_daily_trips(p_route_id bigint, p_driver_id bigint, p_date date, p_start_time time without time zone, p_end_time time without time zone, p_interval_min integer, p_trip_duration_min integer); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.generate_daily_trips(p_route_id bigint, p_driver_id bigint, p_date date, p_start_time time without time zone, p_end_time time without time zone, p_interval_min integer, p_trip_duration_min integer) TO ct_dispatcher_role;


--
-- Name: FUNCTION get_dashboard(); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.get_dashboard() TO ct_dispatcher_role;


--
-- Name: FUNCTION get_departure_times(p_work_start_time time without time zone, p_work_end_time time without time zone, p_interval_min integer); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.get_departure_times(p_work_start_time time without time zone, p_work_end_time time without time zone, p_interval_min integer) TO ct_dispatcher_role;


--
-- Name: FUNCTION update_schedule(p_schedule_id bigint, p_route_id bigint, p_vehicle_id bigint, p_start time without time zone, p_end time without time zone, p_interval integer, p_monday boolean, p_tuesday boolean, p_wednesday boolean, p_thursday boolean, p_friday boolean, p_saturday boolean, p_sunday boolean, p_valid_from date, p_valid_to date); Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION dispatcher_api.update_schedule(p_schedule_id bigint, p_route_id bigint, p_vehicle_id bigint, p_start time without time zone, p_end time without time zone, p_interval integer, p_monday boolean, p_tuesday boolean, p_wednesday boolean, p_thursday boolean, p_friday boolean, p_saturday boolean, p_sunday boolean, p_valid_from date, p_valid_to date) TO ct_dispatcher_role;


--
-- Name: FUNCTION cleanup_stale_trips(p_driver_id bigint); Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION driver_api.cleanup_stale_trips(p_driver_id bigint) TO ct_driver_role;


--
-- Name: FUNCTION finish_trip(p_ended_at timestamp without time zone); Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION driver_api.finish_trip(p_ended_at timestamp without time zone) TO ct_driver_role;


--
-- Name: FUNCTION log_vehicle_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone); Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION driver_api.log_vehicle_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone) TO ct_driver_role;


--
-- Name: FUNCTION start_trip(p_trip_id bigint, p_started_at timestamp without time zone); Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION driver_api.start_trip(p_trip_id bigint, p_started_at timestamp without time zone) TO ct_driver_role;


--
-- Name: FUNCTION update_passengers(p_trip_id bigint, p_passenger_count integer); Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION driver_api.update_passengers(p_trip_id bigint, p_passenger_count integer) TO ct_driver_role;


--
-- Name: FUNCTION find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer); Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) TO ct_guest_role;
GRANT ALL ON FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) TO ct_passenger_role;
GRANT ALL ON FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) TO ct_driver_role;
GRANT ALL ON FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) TO ct_dispatcher_role;
GRANT ALL ON FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) TO ct_municipality_role;
GRANT ALL ON FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) TO ct_controller_role;
GRANT ALL ON FUNCTION guest_api.find_nearby_stops(p_lon numeric, p_lat numeric, p_radius_m numeric, p_limit integer) TO ct_manager_role;


--
-- Name: FUNCTION find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer); Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) TO ct_guest_role;
GRANT ALL ON FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) TO ct_passenger_role;
GRANT ALL ON FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) TO ct_driver_role;
GRANT ALL ON FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) TO ct_dispatcher_role;
GRANT ALL ON FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) TO ct_municipality_role;
GRANT ALL ON FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) TO ct_controller_role;
GRANT ALL ON FUNCTION guest_api.find_nearest_stop_to_point(p_lon numeric, p_lat numeric, p_limit integer) TO ct_manager_role;


--
-- Name: FUNCTION get_route_stops_with_timing(p_route_id bigint); Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) TO ct_guest_role;
GRANT ALL ON FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) TO ct_passenger_role;
GRANT ALL ON FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) TO ct_driver_role;
GRANT ALL ON FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) TO ct_dispatcher_role;
GRANT ALL ON FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) TO ct_municipality_role;
GRANT ALL ON FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) TO ct_controller_role;
GRANT ALL ON FUNCTION guest_api.get_route_stops_with_timing(p_route_id bigint) TO ct_manager_role;


--
-- Name: FUNCTION plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer); Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_guest_role;
GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_passenger_role;
GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_driver_role;
GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_dispatcher_role;
GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_controller_role;
GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_municipality_role;
GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_manager_role;
GRANT ALL ON FUNCTION guest_api.plan_route(p_lon_a numeric, p_lat_a numeric, p_lon_b numeric, p_lat_b numeric, p_radius_m numeric, p_max_wait_min integer, p_max_results integer) TO ct_accountant_role;


--
-- Name: FUNCTION plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer); Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_guest_role;
GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_passenger_role;
GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_driver_role;
GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_dispatcher_role;
GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_controller_role;
GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_municipality_role;
GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_manager_role;
GRANT ALL ON FUNCTION guest_api.plan_route_pgrouting(p_start_stop_ids bigint[], p_end_stop_ids bigint[], p_transfer_penalty integer, p_max_paths integer) TO ct_accountant_role;


--
-- Name: FUNCTION search_stops_by_name(p_query text, p_limit integer); Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_guest_role;
GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_passenger_role;
GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_driver_role;
GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_dispatcher_role;
GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_controller_role;
GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_municipality_role;
GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_manager_role;
GRANT ALL ON FUNCTION guest_api.search_stops_by_name(p_query text, p_limit integer) TO ct_accountant_role;


--
-- Name: FUNCTION submit_complaint(p_type text, p_message text, p_contact_info text, p_route_number text, p_transport_type text, p_vehicle_number text); Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION guest_api.submit_complaint(p_type text, p_message text, p_contact_info text, p_route_number text, p_transport_type text, p_vehicle_number text) TO ct_guest_role;
GRANT ALL ON FUNCTION guest_api.submit_complaint(p_type text, p_message text, p_contact_info text, p_route_number text, p_transport_type text, p_vehicle_number text) TO ct_passenger_role;


--
-- Name: FUNCTION add_vehicle(p_fleet_number text, p_model_id bigint, p_route_number text); Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION manager_api.add_vehicle(p_fleet_number text, p_model_id bigint, p_route_number text) TO ct_manager_role;


--
-- Name: FUNCTION add_vehicle_v2(p_fleet_number text, p_model_id bigint, p_route_id bigint, p_route_number text); Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION manager_api.add_vehicle_v2(p_fleet_number text, p_model_id bigint, p_route_id bigint, p_route_number text) TO ct_manager_role;


--
-- Name: FUNCTION create_staff_user(p_login text, p_password text, p_role text, p_full_name text, p_email text, p_phone text); Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION manager_api.create_staff_user(p_login text, p_password text, p_role text, p_full_name text, p_email text, p_phone text) TO ct_manager_role;


--
-- Name: FUNCTION hire_driver(p_login text, p_password text, p_email text, p_phone text, p_full_name text, p_license_number text, p_categories jsonb, p_passport_data jsonb); Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION manager_api.hire_driver(p_login text, p_password text, p_email text, p_phone text, p_full_name text, p_license_number text, p_categories jsonb, p_passport_data jsonb) TO ct_manager_role;


--
-- Name: FUNCTION remove_staff_user(p_login text); Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION manager_api.remove_staff_user(p_login text) TO ct_manager_role;


--
-- Name: FUNCTION create_route_full(p_number text, p_transport_type_id integer, p_direction text, p_stops_json jsonb, p_points_json jsonb); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.create_route_full(p_number text, p_transport_type_id integer, p_direction text, p_stops_json jsonb, p_points_json jsonb) TO ct_municipality_role;


--
-- Name: FUNCTION create_stop(p_name text, p_lon numeric, p_lat numeric); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.create_stop(p_name text, p_lon numeric, p_lat numeric) TO ct_municipality_role;


--
-- Name: FUNCTION get_complaints(p_start_date date, p_end_date date, p_route_number text, p_transport_type text, p_fleet_number text); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.get_complaints(p_start_date date, p_end_date date, p_route_number text, p_transport_type text, p_fleet_number text) TO ct_municipality_role;


--
-- Name: FUNCTION get_flow_summary(p_from date, p_to date, p_route_number text, p_transport_type_id integer); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.get_flow_summary(p_from date, p_to date, p_route_number text, p_transport_type_id integer) TO ct_municipality_role;


--
-- Name: FUNCTION get_passenger_flow(p_start_date date, p_end_date date, p_route_number text, p_transport_type text); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.get_passenger_flow(p_start_date date, p_end_date date, p_route_number text, p_transport_type text) TO ct_municipality_role;


--
-- Name: FUNCTION get_passenger_trend(p_from date, p_to date, p_route_number text, p_transport_type_id integer); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.get_passenger_trend(p_from date, p_to date, p_route_number text, p_transport_type_id integer) TO ct_municipality_role;


--
-- Name: FUNCTION get_top_routes(p_from date, p_to date, p_transport_type_id integer, p_limit integer); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.get_top_routes(p_from date, p_to date, p_transport_type_id integer, p_limit integer) TO ct_municipality_role;


--
-- Name: FUNCTION recalculate_route_stop_distances(p_route_id bigint); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.recalculate_route_stop_distances(p_route_id bigint) TO ct_municipality_role;


--
-- Name: FUNCTION set_route_active(p_route_id bigint, p_is_active boolean); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.set_route_active(p_route_id bigint, p_is_active boolean) TO ct_municipality_role;


--
-- Name: FUNCTION update_complaint_status(p_id bigint, p_status text); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.update_complaint_status(p_id bigint, p_status text) TO ct_municipality_role;


--
-- Name: FUNCTION update_stop(p_id bigint, p_name text, p_lon numeric, p_lat numeric); Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION municipality_api.update_stop(p_id bigint, p_name text, p_lon numeric, p_lat numeric) TO ct_municipality_role;


--
-- Name: FUNCTION buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.buy_ticket(p_card_id bigint, p_trip_id bigint, p_price numeric) TO ct_passenger_role;


--
-- Name: FUNCTION find_routes_between(p_start_lon numeric, p_start_lat numeric, p_end_lon numeric, p_end_lat numeric, p_radius_m integer); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.find_routes_between(p_start_lon numeric, p_start_lat numeric, p_end_lon numeric, p_end_lat numeric, p_radius_m integer) TO ct_passenger_role;


--
-- Name: FUNCTION find_stops_nearby(p_lon numeric, p_lat numeric, p_radius_m integer); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.find_stops_nearby(p_lon numeric, p_lat numeric, p_radius_m integer) TO ct_passenger_role;


--
-- Name: FUNCTION log_my_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.log_my_gps(p_lon numeric, p_lat numeric, p_recorded_at timestamp without time zone) TO ct_passenger_role;


--
-- Name: FUNCTION pay_fine(p_fine_id bigint, p_card_id bigint); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.pay_fine(p_fine_id bigint, p_card_id bigint) TO ct_passenger_role;


--
-- Name: FUNCTION submit_complaint(p_type text, p_message text, p_route_number text, p_transport_type text, p_vehicle_number text); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.submit_complaint(p_type text, p_message text, p_route_number text, p_transport_type text, p_vehicle_number text) TO ct_passenger_role;


--
-- Name: FUNCTION submit_fine_appeal(p_fine_id bigint, p_message text); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.submit_fine_appeal(p_fine_id bigint, p_message text) TO ct_passenger_role;


--
-- Name: FUNCTION top_up_card(p_card text, p_amt numeric); Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT ALL ON FUNCTION passenger_api.top_up_card(p_card text, p_amt numeric) TO ct_passenger_role;


--
-- Name: FUNCTION distance_km(lon1 numeric, lat1 numeric, lon2 numeric, lat2 numeric); Type: ACL; Schema: public; Owner: ct_migrator
--

REVOKE ALL ON FUNCTION public.distance_km(lon1 numeric, lat1 numeric, lon2 numeric, lat2 numeric) FROM PUBLIC;


--
-- Name: FUNCTION format_minutes_to_time(total_minutes numeric); Type: ACL; Schema: public; Owner: ct_migrator
--

REVOKE ALL ON FUNCTION public.format_minutes_to_time(total_minutes numeric) FROM PUBLIC;


--
-- Name: FUNCTION parse_time_to_minutes(time_val time without time zone); Type: ACL; Schema: public; Owner: ct_migrator
--

REVOKE ALL ON FUNCTION public.parse_time_to_minutes(time_val time without time zone) FROM PUBLIC;


--
-- Name: TABLE v_budgets; Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE accountant_api.v_budgets TO ct_accountant_role;


--
-- Name: TABLE v_drivers_list; Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE accountant_api.v_drivers_list TO ct_accountant_role;


--
-- Name: TABLE v_expenses; Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE accountant_api.v_expenses TO ct_accountant_role;


--
-- Name: TABLE v_financial_report; Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE accountant_api.v_financial_report TO ct_accountant_role;


--
-- Name: TABLE v_salary_history; Type: ACL; Schema: accountant_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE accountant_api.v_salary_history TO ct_accountant_role;


--
-- Name: TABLE v_card_details; Type: ACL; Schema: controller_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE controller_api.v_card_details TO ct_controller_role;


--
-- Name: TABLE v_routes; Type: ACL; Schema: controller_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE controller_api.v_routes TO ct_controller_role;


--
-- Name: TABLE v_vehicles; Type: ACL; Schema: controller_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE controller_api.v_vehicles TO ct_controller_role;


--
-- Name: TABLE v_active_trip_deviations; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_active_trip_deviations TO ct_dispatcher_role;


--
-- Name: TABLE v_active_trips; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_active_trips TO ct_dispatcher_role;


--
-- Name: TABLE v_assignments_history; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_assignments_history TO ct_dispatcher_role;


--
-- Name: TABLE v_drivers_list; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_drivers_list TO ct_dispatcher_role;


--
-- Name: TABLE v_scheduled_trips_today; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_scheduled_trips_today TO ct_dispatcher_role;


--
-- Name: TABLE v_schedules_list; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_schedules_list TO ct_dispatcher_role;


--
-- Name: TABLE v_trips_list; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_trips_list TO ct_dispatcher_role;


--
-- Name: TABLE v_vehicle_monitoring; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_vehicle_monitoring TO ct_dispatcher_role;


--
-- Name: TABLE v_vehicles_list; Type: ACL; Schema: dispatcher_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE dispatcher_api.v_vehicles_list TO ct_dispatcher_role;


--
-- Name: TABLE v_my_active_trip; Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE driver_api.v_my_active_trip TO ct_driver_role;


--
-- Name: TABLE v_my_assignments; Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE driver_api.v_my_assignments TO ct_driver_role;


--
-- Name: TABLE v_my_schedule; Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE driver_api.v_my_schedule TO ct_driver_role;


--
-- Name: TABLE v_my_scheduled_trips; Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE driver_api.v_my_scheduled_trips TO ct_driver_role;


--
-- Name: TABLE v_my_today_schedule; Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE driver_api.v_my_today_schedule TO ct_driver_role;


--
-- Name: TABLE v_my_trips; Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE driver_api.v_my_trips TO ct_driver_role;


--
-- Name: TABLE v_profile; Type: ACL; Schema: driver_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE driver_api.v_profile TO ct_driver_role;


--
-- Name: TABLE v_route_geometries; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_route_geometries TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_route_geometries TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_route_geometries TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_route_geometries TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_route_geometries TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_route_geometries TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_route_geometries TO ct_manager_role;


--
-- Name: TABLE v_route_points; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_route_points TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_route_points TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_route_points TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_route_points TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_route_points TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_route_points TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_route_points TO ct_manager_role;


--
-- Name: TABLE v_route_points_ordered; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_route_points_ordered TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_route_points_ordered TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_route_points_ordered TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_route_points_ordered TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_route_points_ordered TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_route_points_ordered TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_route_points_ordered TO ct_manager_role;


--
-- Name: TABLE v_route_stops; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_route_stops TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_route_stops TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_route_stops TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_route_stops TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_route_stops TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_route_stops TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_route_stops TO ct_manager_role;


--
-- Name: TABLE v_route_stops_ordered; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_route_stops_ordered TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_route_stops_ordered TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_route_stops_ordered TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_route_stops_ordered TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_route_stops_ordered TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_route_stops_ordered TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_route_stops_ordered TO ct_manager_role;


--
-- Name: TABLE v_routes; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_routes TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_routes TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_routes TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_routes TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_routes TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_routes TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_routes TO ct_manager_role;


--
-- Name: TABLE v_schedules; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_schedules TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_schedules TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_schedules TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_schedules TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_schedules TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_schedules TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_schedules TO ct_manager_role;


--
-- Name: TABLE v_stop_geometries; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_stop_geometries TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_stop_geometries TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_stop_geometries TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_stop_geometries TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_stop_geometries TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_stop_geometries TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_stop_geometries TO ct_manager_role;


--
-- Name: TABLE v_stops; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_stops TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_stops TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_stops TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_stops TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_stops TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_stops TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_stops TO ct_manager_role;


--
-- Name: TABLE v_transport_types; Type: ACL; Schema: guest_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE guest_api.v_transport_types TO ct_guest_role;
GRANT SELECT ON TABLE guest_api.v_transport_types TO ct_passenger_role;
GRANT SELECT ON TABLE guest_api.v_transport_types TO ct_driver_role;
GRANT SELECT ON TABLE guest_api.v_transport_types TO ct_dispatcher_role;
GRANT SELECT ON TABLE guest_api.v_transport_types TO ct_municipality_role;
GRANT SELECT ON TABLE guest_api.v_transport_types TO ct_controller_role;
GRANT SELECT ON TABLE guest_api.v_transport_types TO ct_manager_role;


--
-- Name: TABLE v_drivers; Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE manager_api.v_drivers TO ct_manager_role;


--
-- Name: TABLE v_staff_roles; Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE manager_api.v_staff_roles TO ct_manager_role;


--
-- Name: TABLE v_vehicle_models; Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE manager_api.v_vehicle_models TO ct_manager_role;


--
-- Name: TABLE v_vehicles; Type: ACL; Schema: manager_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE manager_api.v_vehicles TO ct_manager_role;


--
-- Name: TABLE v_complaints_dashboard; Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE municipality_api.v_complaints_dashboard TO ct_municipality_role;


--
-- Name: TABLE v_passenger_flow_analytics; Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE municipality_api.v_passenger_flow_analytics TO ct_municipality_role;


--
-- Name: TABLE v_routes; Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE municipality_api.v_routes TO ct_municipality_role;


--
-- Name: TABLE v_stops; Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE municipality_api.v_stops TO ct_municipality_role;


--
-- Name: TABLE v_trip_passenger_fact; Type: ACL; Schema: municipality_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE municipality_api.v_trip_passenger_fact TO ct_municipality_role;


--
-- Name: TABLE v_my_appeals; Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE passenger_api.v_my_appeals TO ct_passenger_role;


--
-- Name: TABLE v_my_cards; Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE passenger_api.v_my_cards TO ct_passenger_role;


--
-- Name: TABLE v_my_fines; Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE passenger_api.v_my_fines TO ct_passenger_role;


--
-- Name: TABLE v_my_gps_history; Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE passenger_api.v_my_gps_history TO ct_passenger_role;


--
-- Name: TABLE v_my_profile; Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE passenger_api.v_my_profile TO ct_passenger_role;


--
-- Name: TABLE v_my_trips; Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE passenger_api.v_my_trips TO ct_passenger_role;


--
-- Name: TABLE v_transport_at_stops; Type: ACL; Schema: passenger_api; Owner: ct_migrator
--

GRANT SELECT ON TABLE passenger_api.v_transport_at_stops TO ct_passenger_role;


--
-- PostgreSQL database dump complete
--

