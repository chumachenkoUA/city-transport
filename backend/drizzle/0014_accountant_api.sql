-- 0014_accountant_api.sql

-- 1. БЮДЖЕТ (Вимога 1.1)

CREATE OR REPLACE FUNCTION accountant_api.upsert_budget(
    p_month date,
    p_income numeric DEFAULT 0,
    p_expenses numeric DEFAULT 0,
    p_note text DEFAULT NULL
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
DECLARE
    v_id bigint;
BEGIN
    INSERT INTO public.budgets (month, income, expenses, note)
    VALUES (p_month, p_income, p_expenses, p_note)
    ON CONFLICT (month) DO UPDATE
        SET income = EXCLUDED.income,
            expenses = EXCLUDED.expenses,
            note = COALESCE(EXCLUDED.note, budgets.note)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW accountant_api.v_budgets AS
SELECT id, month, income as planned_income, expenses as planned_expenses, note
FROM public.budgets
ORDER BY month DESC;

-- 2. ВИТРАТИ (Вимога 1.2)

CREATE OR REPLACE FUNCTION accountant_api.add_expense(
    p_category text,
    p_amount numeric,
    p_description text DEFAULT NULL,
    p_document_ref text DEFAULT NULL,
    p_occurred_at timestamp DEFAULT now()
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
DECLARE
    v_id bigint;
BEGIN
    INSERT INTO public.expenses (category, amount, description, document_ref, occurred_at)
    VALUES (p_category, p_amount, p_description, p_document_ref, p_occurred_at)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW accountant_api.v_expenses AS
SELECT * FROM public.expenses ORDER BY occurred_at DESC;

-- 3. ЗАРПЛАТА (Вимога 2.1)

CREATE OR REPLACE FUNCTION accountant_api.pay_salary(
    p_driver_id bigint DEFAULT NULL,
    p_employee_name text DEFAULT NULL,
    p_role text DEFAULT 'Інше',
    p_rate numeric DEFAULT 0,
    p_units integer DEFAULT 0, -- години/зміни
    p_total numeric DEFAULT 0
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
DECLARE
    v_id bigint;
    v_final_total numeric;
BEGIN
    -- Якщо total не передано, рахуємо rate * units
    IF p_total = 0 AND p_rate > 0 AND p_units > 0 THEN
        v_final_total := p_rate * p_units;
    ELSE
        v_final_total := p_total;
    END IF;

    IF v_final_total <= 0 THEN
        RAISE EXCEPTION 'Salary total must be positive';
    END IF;

    INSERT INTO public.salary_payments (
        driver_id, employee_name, employee_role, rate, units, total, paid_at
    )
    VALUES (
               p_driver_id, p_employee_name, p_role, p_rate, p_units, v_final_total, now()
           )
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE VIEW accountant_api.v_salary_history AS
SELECT
    sp.id,
    sp.paid_at,
    COALESCE(d.full_name, sp.employee_name) as employee_name,
    COALESCE(sp.employee_role, 'Водій') as role,
    sp.total
FROM public.salary_payments sp
         LEFT JOIN public.drivers d ON d.id = sp.driver_id
ORDER BY sp.paid_at DESC;

-- 4. ЗВІТНІСТЬ (Вимога 1.3, 3.1, 2.2)

-- Функція для отримання звіту за період
CREATE OR REPLACE FUNCTION accountant_api.get_financial_report(
    p_start_date date,
    p_end_date date
)
    RETURNS TABLE (
                      category text,
                      amount numeric,
                      type text -- 'income' or 'expense'
                  )
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Доходи: Продаж квитків (реально списання з карток за поїздки)
    RETURN QUERY
        SELECT 'Квитки'::text, COALESCE(SUM(price), 0), 'income'::text
        FROM public.tickets
        WHERE purchased_at >= p_start_date AND purchased_at < p_end_date + 1;

    -- Доходи: Поповнення карток (реальні гроші, що зайшли)
    -- (Залежно від облікової політики: рахуємо поповнення або списання.
    -- Зазвичай cash flow - це поповнення. Revenue - це квитки.
    -- Давайте покажемо обидва, але позначимо поповнення як "Надходження коштів")
    RETURN QUERY
        SELECT 'Поповнення карток'::text, COALESCE(SUM(amount), 0), 'income_flow'::text
        FROM public.card_top_ups
        WHERE topped_up_at >= p_start_date AND topped_up_at < p_end_date + 1;

    -- Доходи: Штрафи (сплачені)
    RETURN QUERY
        SELECT 'Штрафи'::text, COALESCE(SUM(amount), 0), 'income'::text
        FROM public.fines
        WHERE status = 'Оплачено' AND issued_at >= p_start_date AND issued_at < p_end_date + 1;

    -- Витрати: Операційні
    RETURN QUERY
        SELECT e.category, COALESCE(SUM(e.amount), 0), 'expense'::text
        FROM public.expenses e
        WHERE e.occurred_at >= p_start_date AND e.occurred_at < p_end_date + 1
        GROUP BY e.category;

    -- Витрати: Зарплата
    RETURN QUERY
        SELECT 'Зарплата'::text, COALESCE(SUM(total), 0), 'expense'::text
        FROM public.salary_payments
        WHERE paid_at >= p_start_date AND paid_at < p_end_date + 1;
END;
$$;

-- 5. GRANTS

GRANT EXECUTE ON FUNCTION accountant_api.upsert_budget(date, numeric, numeric, text) TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.add_expense(text, numeric, text, text, timestamp) TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.pay_salary(bigint, text, text, numeric, integer, numeric) TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.get_financial_report(date, date) TO ct_accountant_role;

GRANT SELECT ON accountant_api.v_budgets TO ct_accountant_role;
GRANT SELECT ON accountant_api.v_expenses TO ct_accountant_role;
GRANT SELECT ON accountant_api.v_salary_history TO ct_accountant_role;

-- Доступ до списку водіїв для нарахування ЗП
CREATE OR REPLACE VIEW accountant_api.v_drivers_list AS
SELECT id, full_name, driver_license_number FROM public.drivers;
GRANT SELECT ON accountant_api.v_drivers_list TO ct_accountant_role;
