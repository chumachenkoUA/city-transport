-- 0029_controller_fine_validations.sql

CREATE OR REPLACE FUNCTION public.validate_fine_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_trip_id bigint;
BEGIN
  IF NEW.user_id IS NULL THEN
    RAISE EXCEPTION 'user_id is required';
  END IF;

  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  IF NEW.issued_at IS NULL THEN
    NEW.issued_at := now();
  END IF;

  IF NEW.issued_at > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'issued_at is in the future';
  END IF;

  IF NEW.trip_id IS NOT NULL THEN
    SELECT id INTO v_trip_id
    FROM public.trips
    WHERE id = NEW.trip_id
      AND starts_at <= NEW.issued_at
      AND (ends_at IS NULL OR ends_at >= NEW.issued_at);

    IF v_trip_id IS NULL THEN
      RAISE EXCEPTION 'trip_id % is not active at issued_at', NEW.trip_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fines_validate_integrity ON public.fines;
CREATE TRIGGER fines_validate_integrity
BEFORE INSERT OR UPDATE OF user_id, amount, trip_id, issued_at
ON public.fines
FOR EACH ROW
EXECUTE FUNCTION public.validate_fine_integrity();
