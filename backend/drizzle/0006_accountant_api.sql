-- 0006_accountant_api.sql
-- Accountant API: Financial management

-- 1. FUNCTIONS
CREATE OR REPLACE FUNCTION accountant_api.upsert_budget(
    p_month date,
    p_income numeric DEFAULT 0,
    p_expenses numeric DEFAULT 0,
    p_note text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
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

CREATE OR REPLACE FUNCTION accountant_api.add_expense(
    p_category text,
    p_amount numeric,
    p_description text DEFAULT NULL,
    p_document_ref text DEFAULT NULL,
    p_occurred_at timestamp DEFAULT now()
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.expenses (category, amount, description, document_ref, occurred_at)
    VALUES (p_category, p_amount, p_description, p_document_ref, p_occurred_at)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION accountant_api.pay_salary(
    p_driver_id bigint DEFAULT NULL,
    p_employee_name text DEFAULT NULL,
    p_role text DEFAULT 'Інше',
    p_rate numeric DEFAULT 0,
    p_units integer DEFAULT 0,
    p_total numeric DEFAULT 0
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint; v_final_total numeric;
BEGIN
    IF p_total = 0 AND p_rate > 0 AND p_units > 0 THEN
        v_final_total := p_rate * p_units;
    ELSE
        v_final_total := p_total;
    END IF;
    IF v_final_total <= 0 THEN RAISE EXCEPTION 'Salary total must be positive'; END IF;

    INSERT INTO public.salary_payments (driver_id, employee_name, employee_role, rate, units, total, paid_at)
    VALUES (p_driver_id, p_employee_name, p_role, p_rate, p_units, v_final_total, now())
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION accountant_api.get_financial_report(p_start_date date, p_end_date date)
RETURNS TABLE (category text, amount numeric, type text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
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

CREATE OR REPLACE FUNCTION accountant_api.calculate_driver_salary(p_driver_id bigint, p_month date)
RETURNS numeric
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_rate numeric; v_hours numeric;
BEGIN
    SELECT rate INTO v_rate FROM public.salary_payments
    WHERE driver_id = p_driver_id AND rate IS NOT NULL
    ORDER BY paid_at DESC LIMIT 1;

    IF v_rate IS NULL THEN
        RAISE EXCEPTION 'Rate not found for driver %', p_driver_id;
    END IF;

    SELECT COALESCE(SUM(EXTRACT(EPOCH FROM (t.ends_at - t.starts_at)) / 3600.0), 0)
    INTO v_hours FROM public.trips t
    WHERE t.driver_id = p_driver_id
      AND t.starts_at >= date_trunc('month', p_month)
      AND t.starts_at < (date_trunc('month', p_month) + interval '1 month')
      AND t.ends_at IS NOT NULL;

    RETURN round(v_hours * v_rate, 2);
END;
$$;

-- 2. VIEWS
CREATE OR REPLACE VIEW accountant_api.v_budgets AS
SELECT id, month, income as planned_income, expenses as planned_expenses, note
FROM public.budgets ORDER BY month DESC;

CREATE OR REPLACE VIEW accountant_api.v_expenses AS
SELECT * FROM public.expenses ORDER BY occurred_at DESC;

CREATE OR REPLACE VIEW accountant_api.v_salary_history AS
SELECT sp.id, sp.paid_at,
       COALESCE(d.full_name, sp.employee_name) as employee_name,
       COALESCE(sp.employee_role, 'Водій') as role,
       sp.total
FROM public.salary_payments sp
LEFT JOIN public.drivers d ON d.id = sp.driver_id
ORDER BY sp.paid_at DESC;

CREATE OR REPLACE VIEW accountant_api.v_drivers_list AS
SELECT id, full_name, driver_license_number FROM public.drivers;

CREATE OR REPLACE VIEW accountant_api.v_financial_report AS
SELECT t.purchased_at::date AS report_date, 'Квитки'::text AS category,
       COALESCE(SUM(t.price), 0) AS amount, 'income'::text AS type
FROM public.tickets t GROUP BY t.purchased_at::date
UNION ALL
SELECT f.issued_at::date AS report_date, 'Штрафи'::text AS category,
       COALESCE(SUM(f.amount), 0) AS amount, 'income'::text AS type
FROM public.fines f WHERE f.status = 'Оплачено' GROUP BY f.issued_at::date
UNION ALL
SELECT e.occurred_at::date AS report_date, e.category,
       COALESCE(SUM(e.amount), 0) AS amount, 'expense'::text AS type
FROM public.expenses e GROUP BY e.occurred_at::date, e.category
UNION ALL
SELECT sp.paid_at::date AS report_date, 'Зарплата'::text AS category,
       COALESCE(SUM(sp.total), 0) AS amount, 'expense'::text AS type
FROM public.salary_payments sp GROUP BY sp.paid_at::date;

-- 3. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA accountant_api TO ct_accountant_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accountant_api TO ct_accountant_role;
