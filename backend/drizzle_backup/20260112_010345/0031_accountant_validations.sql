-- 0031_accountant_validations.sql

CREATE OR REPLACE FUNCTION public.validate_expense_time()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.occurred_at IS NULL THEN
    NEW.occurred_at := now();
  END IF;

  IF NEW.occurred_at > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'occurred_at is in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS expenses_validate_time ON public.expenses;
CREATE TRIGGER expenses_validate_time
BEFORE INSERT OR UPDATE OF occurred_at
ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.validate_expense_time();

CREATE OR REPLACE FUNCTION public.validate_salary_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_full_name text;
  v_expected_total numeric;
BEGIN
  IF NEW.paid_at IS NULL THEN
    NEW.paid_at := now();
  END IF;

  IF NEW.paid_at > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'paid_at is in the future';
  END IF;

  IF NEW.driver_id IS NOT NULL AND (NEW.employee_name IS NULL OR btrim(NEW.employee_name) = '') THEN
    SELECT full_name INTO v_full_name
    FROM public.drivers
    WHERE id = NEW.driver_id;

    IF v_full_name IS NULL THEN
      RAISE EXCEPTION 'Driver % not found', NEW.driver_id;
    END IF;

    NEW.employee_name := v_full_name;
  END IF;

  IF NEW.rate IS NOT NULL AND NEW.units IS NOT NULL THEN
    v_expected_total := round(NEW.rate * NEW.units, 2);
    IF NEW.total IS NULL OR NEW.total <> v_expected_total THEN
      RAISE EXCEPTION 'total must equal rate * units';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS salary_payments_validate ON public.salary_payments;
CREATE TRIGGER salary_payments_validate
BEFORE INSERT OR UPDATE OF paid_at, rate, units, total, driver_id, employee_name
ON public.salary_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_salary_payment();
