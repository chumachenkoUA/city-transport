-- 0006_accountant_api.sql
-- Accountant API: Financial management

-- ============================================================================
-- 0. ТРИГЕРИ для автоматичного заповнення financial_transactions
-- ============================================================================
-- ОНОВЛЕНО: Тригери тепер заповнюють реальні FK колонки замість ref_table/ref_id
-- Також автоматично заповнюється budget_month для зв'язку з budgets

-- ============================================================================
-- 0.0 Тригер для автозаповнення budget_month на financial_transactions
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_ft_set_budget_month()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.budget_month := date_trunc('month', NEW.occurred_at)::date;

    -- Гарантуємо що бюджетний рядок існує
    INSERT INTO public.budgets(month)
    VALUES (NEW.budget_month)
    ON CONFLICT (month) DO NOTHING;

    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ft_set_budget_month ON public.financial_transactions;
CREATE TRIGGER trg_ft_set_budget_month
BEFORE INSERT OR UPDATE OF occurred_at ON public.financial_transactions
FOR EACH ROW EXECUTE FUNCTION public.trg_ft_set_budget_month();

-- ============================================================================
-- 0.1 Тригер для автозаповнення paid_at на fines
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_fines_set_paid_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status = 'Оплачено'
       AND NEW.paid_at IS NULL THEN
        NEW.paid_at := now();
    END IF;
    RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fines_set_paid_at ON public.fines;
CREATE TRIGGER trg_fines_set_paid_at
BEFORE UPDATE OF status ON public.fines
FOR EACH ROW EXECUTE FUNCTION public.trg_fines_set_paid_at();

-- ============================================================================
-- 0.2 Trigger: tickets -> income (при покупці квитка)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_ticket_to_ft() RETURNS trigger AS $$
DECLARE
    v_route_id bigint;
    v_driver_id bigint;
BEGIN
    -- Отримуємо route_id та driver_id через рейс
    SELECT tr.route_id, tr.driver_id INTO v_route_id, v_driver_id
    FROM public.trips tr
    WHERE tr.id = NEW.trip_id;

    INSERT INTO public.financial_transactions(
        tx_type, source, amount, occurred_at,
        ticket_id, trip_id, route_id, driver_id, card_id
    )
    VALUES (
        'income', 'ticket', NEW.price, NEW.purchased_at,
        NEW.id, NEW.trip_id, v_route_id, v_driver_id, NEW.card_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ticket_income ON public.tickets;
CREATE TRIGGER trg_ticket_income AFTER INSERT ON public.tickets
FOR EACH ROW EXECUTE FUNCTION public.trg_ticket_to_ft();

-- ============================================================================
-- 0.3 Trigger: fines (при оплаті штрафу) -> income
-- ПРИМІТКА: card_top_ups НЕ створюють income, бо поповнення картки - це аванс,
-- а не дохід. Реальний дохід виникає при покупці квитка (source='ticket').
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_fine_to_ft() RETURNS trigger AS $$
DECLARE
    v_route_id bigint;
    v_driver_id bigint;
    v_card_id bigint;
BEGIN
    -- Тільки коли статус змінюється на "Оплачено"
    IF NEW.status = 'Оплачено' AND (OLD IS NULL OR OLD.status <> 'Оплачено') THEN
        -- Отримуємо route_id та driver_id через рейс
        SELECT tr.route_id, tr.driver_id INTO v_route_id, v_driver_id
        FROM public.trips tr
        WHERE tr.id = NEW.trip_id;

        -- Отримуємо card_id через user_id (кожен користувач має картку)
        SELECT tc.id INTO v_card_id
        FROM public.transport_cards tc
        WHERE tc.user_id = NEW.user_id;

        INSERT INTO public.financial_transactions(
            tx_type, source, amount, occurred_at,
            fine_id, trip_id, route_id, driver_id, card_id
        )
        VALUES (
            'income', 'fine', NEW.amount, COALESCE(NEW.paid_at, now()),
            NEW.id, NEW.trip_id, v_route_id, v_driver_id, v_card_id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_fine_income ON public.fines;
CREATE TRIGGER trg_fine_income AFTER INSERT OR UPDATE ON public.fines
FOR EACH ROW EXECUTE FUNCTION public.trg_fine_to_ft();

-- ============================================================================
-- 0.4 Trigger: salary_payments -> expense (при виплаті зарплати)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.trg_salary_to_ft() RETURNS trigger AS $$
BEGIN
    INSERT INTO public.financial_transactions(
        tx_type, source, amount, occurred_at,
        salary_payment_id, driver_id
    )
    VALUES (
        'expense', 'salary', NEW.total, NEW.paid_at,
        NEW.id, NEW.driver_id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_salary_expense ON public.salary_payments;
CREATE TRIGGER trg_salary_expense AFTER INSERT ON public.salary_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_salary_to_ft();

-- ============================================================================
-- 0.5 BACKFILL: Заповнення financial_transactions з існуючих даних
-- ============================================================================
-- Backfill виконується з реальними FK колонками

-- Backfill tickets (з контекстними FK)
INSERT INTO public.financial_transactions(
    tx_type, source, amount, occurred_at,
    ticket_id, trip_id, route_id, driver_id, card_id, created_by
)
SELECT
    'income', 'ticket', t.price, t.purchased_at,
    t.id, t.trip_id, tr.route_id, tr.driver_id, t.card_id, 'migration'
FROM public.tickets t
JOIN public.trips tr ON tr.id = t.trip_id
WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft WHERE ft.ticket_id = t.id
);

-- ПРИМІТКА: card_top_ups НЕ backfill-яться, бо це аванси, а не доходи

-- Backfill paid fines (з контекстними FK)
INSERT INTO public.financial_transactions(
    tx_type, source, amount, occurred_at,
    fine_id, trip_id, route_id, driver_id, card_id, created_by
)
SELECT
    'income', 'fine', f.amount, COALESCE(f.paid_at, f.issued_at),
    f.id, f.trip_id, tr.route_id, tr.driver_id, tc.id, 'migration'
FROM public.fines f
JOIN public.trips tr ON tr.id = f.trip_id
JOIN public.transport_cards tc ON tc.user_id = f.user_id
WHERE f.status = 'Оплачено' AND NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft WHERE ft.fine_id = f.id
);

-- Backfill salary_payments (з контекстними FK)
INSERT INTO public.financial_transactions(
    tx_type, source, amount, occurred_at,
    salary_payment_id, driver_id, created_by
)
SELECT
    'expense', 'salary', sp.total, sp.paid_at,
    sp.id, sp.driver_id, 'migration'
FROM public.salary_payments sp
WHERE NOT EXISTS (
    SELECT 1 FROM public.financial_transactions ft WHERE ft.salary_payment_id = sp.id
);

-- ============================================================================
-- 1. FUNCTIONS
-- ============================================================================

-- Функція для додавання доходу (пише напряму в financial_transactions)
-- Використовується для ручних записів: держбюджет, інші доходи
CREATE OR REPLACE FUNCTION accountant_api.add_income(
    p_source text,
    p_amount numeric,
    p_description text DEFAULT NULL,
    p_received_at timestamp DEFAULT now()
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
    -- Валідація джерела (тільки ручні записи - автоматичні йдуть через тригери)
    IF p_source NOT IN ('government', 'other') THEN
        RAISE EXCEPTION 'Для ручного доходу дозволені тільки: government, other. Квитки/штрафи записуються автоматично.';
    END IF;

    INSERT INTO public.financial_transactions (tx_type, source, amount, occurred_at, description)
    VALUES ('income', p_source, p_amount, p_received_at, p_description)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- Функція для планування бюджету (планові показники)
CREATE OR REPLACE FUNCTION accountant_api.upsert_budget(
    p_month date,
    p_planned_income numeric DEFAULT 0,
    p_planned_expenses numeric DEFAULT 0,
    p_note text DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
    INSERT INTO public.budgets (month, planned_income, planned_expenses, note)
    VALUES (p_month, p_planned_income, p_planned_expenses, p_note)
    ON CONFLICT (month) DO UPDATE SET
        planned_income = EXCLUDED.planned_income,
        planned_expenses = EXCLUDED.planned_expenses,
        note = COALESCE(EXCLUDED.note, budgets.note)
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

-- Функція для оновлення фактичних показників бюджету
-- ОНОВЛЕНО: тепер використовує budget_month FK (швидше та надійніше)
CREATE OR REPLACE FUNCTION accountant_api.update_budget_actuals(p_month date)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE
    v_m date := date_trunc('month', p_month)::date;
    v_income numeric;
    v_expense numeric;
BEGIN
    -- Рахуємо з budget_month FK (швидше та надійніше)
    SELECT COALESCE(SUM(amount), 0) INTO v_income
    FROM public.financial_transactions
    WHERE budget_month = v_m AND tx_type = 'income';

    SELECT COALESCE(SUM(amount), 0) INTO v_expense
    FROM public.financial_transactions
    WHERE budget_month = v_m AND tx_type = 'expense';

    -- Оновлюємо запис бюджету (має вже існувати завдяки тригеру trg_ft_set_budget_month)
    UPDATE public.budgets
    SET actual_income = v_income,
        actual_expenses = v_expense
    WHERE month = v_m;

    -- Якщо запис не існує, створюємо його
    IF NOT FOUND THEN
        INSERT INTO public.budgets (month, planned_income, planned_expenses, actual_income, actual_expenses)
        VALUES (v_m, 0, 0, v_income, v_expense);
    END IF;
END;
$$;

-- Функція для додавання витрат (пише напряму в financial_transactions)
-- Категорії: fuel, maintenance, other_expense
CREATE OR REPLACE FUNCTION accountant_api.add_expense(
    p_category text,
    p_amount numeric,
    p_description text DEFAULT NULL,
    p_occurred_at timestamp DEFAULT now()
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint; v_source text;
BEGIN
    -- Мапінг категорії на source
    v_source := CASE p_category
        WHEN 'fuel' THEN 'fuel'
        WHEN 'maintenance' THEN 'maintenance'
        ELSE 'other_expense'
    END;

    INSERT INTO public.financial_transactions (tx_type, source, amount, occurred_at, description)
    VALUES ('expense', v_source, p_amount, p_occurred_at,
            COALESCE(p_category || ': ', '') || COALESCE(p_description, ''))
    RETURNING id INTO v_id;
    RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION accountant_api.pay_salary(
    p_driver_id bigint,
    p_rate numeric DEFAULT NULL,
    p_units integer DEFAULT NULL,
    p_total numeric DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog
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

-- ОНОВЛЕНО: тепер рахує з financial_transactions (єдине джерело правди)
CREATE OR REPLACE FUNCTION accountant_api.get_financial_report(p_start_date date, p_end_date date)
RETURNS TABLE (category text, amount numeric, type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_catalog
AS $$
    SELECT
        CASE source
            WHEN 'ticket' THEN 'Квитки'
            WHEN 'fine' THEN 'Штрафи'
            WHEN 'government' THEN 'Держбюджет'
            WHEN 'other' THEN 'Інше'
            WHEN 'salary' THEN 'Зарплата'
            WHEN 'fuel' THEN 'Паливо'
            WHEN 'maintenance' THEN 'Обслуговування'
            WHEN 'other_expense' THEN COALESCE(expense_desc, 'Витрати')
            ELSE source
        END AS category,
        total_amount AS amount,
        tx_type AS type
    FROM (
        SELECT
            source,
            tx_type,
            SUM(amount) AS total_amount,
            CASE WHEN source = 'other_expense' THEN description ELSE NULL END AS expense_desc
        FROM public.financial_transactions
        WHERE occurred_at >= p_start_date AND occurred_at < p_end_date + 1
        GROUP BY source, tx_type, CASE WHEN source = 'other_expense' THEN description ELSE NULL END
    ) grouped
    ORDER BY tx_type, source;
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

-- 2. VIEWS
CREATE OR REPLACE VIEW accountant_api.v_budgets AS
SELECT id, month, planned_income, planned_expenses, actual_income, actual_expenses, note
FROM public.budgets ORDER BY month DESC;

-- v_expenses тепер читає з financial_transactions
CREATE OR REPLACE VIEW accountant_api.v_expenses AS
SELECT id,
       CASE source
           WHEN 'other_expense' THEN split_part(description, ':', 1)
           ELSE source
       END as category,
       amount,
       CASE
           WHEN source = 'other_expense' THEN nullif(trim(split_part(description, ':', 2)), '')
           ELSE description
       END as description,
       occurred_at
FROM public.financial_transactions
WHERE tx_type = 'expense'
ORDER BY occurred_at DESC;

-- v_incomes тепер читає з financial_transactions
CREATE OR REPLACE VIEW accountant_api.v_incomes AS
SELECT id, source, amount, description, occurred_at as received_at
FROM public.financial_transactions
WHERE tx_type = 'income'
ORDER BY occurred_at DESC;

CREATE OR REPLACE VIEW accountant_api.v_salary_history AS
SELECT sp.id, sp.paid_at,
       sp.driver_id,
       d.full_name as driver_name,
       d.driver_license_number as license_number,
       sp.rate,
       sp.units,
       sp.total
FROM public.salary_payments sp
JOIN public.drivers d ON d.id = sp.driver_id
ORDER BY sp.paid_at DESC;

CREATE OR REPLACE VIEW accountant_api.v_drivers_list AS
SELECT id, full_name, driver_license_number FROM public.drivers;

-- v_financial_report тепер читає з financial_transactions (єдине джерело правди)
CREATE OR REPLACE VIEW accountant_api.v_financial_report AS
SELECT
    report_date,
    CASE source
        WHEN 'ticket' THEN 'Квитки'
        WHEN 'fine' THEN 'Штрафи'
        WHEN 'government' THEN 'Держбюджет'
        WHEN 'other' THEN 'Інші доходи'
        WHEN 'salary' THEN 'Зарплата'
        WHEN 'fuel' THEN 'Паливо'
        WHEN 'maintenance' THEN 'Обслуговування'
        WHEN 'other_expense' THEN COALESCE(expense_cat, 'Витрати')
        ELSE source
    END AS category,
    total_amount AS amount,
    tx_type AS type
FROM (
    SELECT
        occurred_at::date AS report_date,
        source,
        tx_type,
        SUM(amount) AS total_amount,
        CASE WHEN source = 'other_expense' THEN split_part(description, ':', 1) ELSE NULL END AS expense_cat
    FROM public.financial_transactions
    GROUP BY occurred_at::date, source, tx_type,
             CASE WHEN source = 'other_expense' THEN split_part(description, ':', 1) ELSE NULL END
) grouped;

-- View для financial_transactions (з реальними FK колонками)
-- user_id отримується через card_id -> transport_cards.user_id
CREATE OR REPLACE VIEW accountant_api.v_financial_transactions AS
SELECT ft.id, ft.tx_type, ft.source, ft.amount, ft.occurred_at, ft.description, ft.created_by,
       ft.ticket_id, ft.fine_id, ft.salary_payment_id,
       ft.trip_id, ft.route_id, ft.driver_id, ft.card_id,
       tc.user_id,  -- денормалізація через JOIN
       ft.budget_month
FROM public.financial_transactions ft
LEFT JOIN public.transport_cards tc ON tc.id = ft.card_id
ORDER BY ft.occurred_at DESC;

-- View для аналітики по джерелах та місяцях
CREATE OR REPLACE VIEW accountant_api.v_fin_by_source AS
SELECT
    budget_month,
    tx_type,
    source,
    SUM(amount) AS total_amount,
    COUNT(*) AS ops_count
FROM public.financial_transactions
GROUP BY budget_month, tx_type, source
ORDER BY budget_month DESC, tx_type, source;

-- 3. GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA accountant_api TO ct_accountant_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accountant_api TO ct_accountant_role;
