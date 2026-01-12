-- 0017_fix_accountant_report.sql

CREATE OR REPLACE FUNCTION accountant_api.get_financial_report(
    p_start_date date,
    p_end_date date
)
    RETURNS TABLE (
                      category text,
                      amount numeric,
                      type text
                  )
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
        SELECT 'Квитки'::text, COALESCE(SUM(price), 0), 'income'::text
        FROM public.tickets
        WHERE purchased_at >= p_start_date AND purchased_at < p_end_date + 1;

    RETURN QUERY
        SELECT 'Поповнення карток'::text, COALESCE(SUM(ct.amount), 0), 'income_flow'::text
        FROM public.card_top_ups ct
        WHERE topped_up_at >= p_start_date AND topped_up_at < p_end_date + 1;

    RETURN QUERY
        SELECT 'Штрафи'::text, COALESCE(SUM(f.amount), 0), 'income'::text
        FROM public.fines f
        WHERE status = 'Оплачено' AND issued_at >= p_start_date AND issued_at < p_end_date + 1;

    RETURN QUERY
        SELECT e.category, COALESCE(SUM(e.amount), 0), 'expense'::text
        FROM public.expenses e
        WHERE e.occurred_at >= p_start_date AND e.occurred_at < p_end_date + 1
        GROUP BY e.category;

    RETURN QUERY
        SELECT 'Зарплата'::text, COALESCE(SUM(total), 0), 'expense'::text
        FROM public.salary_payments
        WHERE paid_at >= p_start_date AND paid_at < p_end_date + 1;
END;
$$;

GRANT EXECUTE ON FUNCTION accountant_api.get_financial_report(date, date) TO ct_accountant_role;
