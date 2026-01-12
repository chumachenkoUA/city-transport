-- 0033_passenger_validations.sql

CREATE OR REPLACE FUNCTION public.validate_card_top_up()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.amount IS NULL OR NEW.amount <= 0 THEN
    RAISE EXCEPTION 'amount must be > 0';
  END IF;

  IF NEW.topped_up_at IS NULL THEN
    NEW.topped_up_at := now();
  END IF;

  IF NEW.topped_up_at > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'topped_up_at is in the future';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS card_top_ups_validate ON public.card_top_ups;
CREATE TRIGGER card_top_ups_validate
BEFORE INSERT OR UPDATE OF amount, topped_up_at
ON public.card_top_ups
FOR EACH ROW
EXECUTE FUNCTION public.validate_card_top_up();

CREATE OR REPLACE FUNCTION public.validate_transport_card_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.balance IS NULL OR NEW.balance < 0 THEN
    RAISE EXCEPTION 'balance cannot be negative';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transport_cards_validate_balance ON public.transport_cards;
CREATE TRIGGER transport_cards_validate_balance
BEFORE INSERT OR UPDATE OF balance
ON public.transport_cards
FOR EACH ROW
EXECUTE FUNCTION public.validate_transport_card_balance();

CREATE OR REPLACE FUNCTION public.validate_complaint_suggestion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_vehicle_id bigint;
BEGIN
  IF NEW.message IS NULL OR btrim(NEW.message) = '' THEN
    RAISE EXCEPTION 'message is required';
  END IF;

  IF NEW.created_at IS NULL THEN
    NEW.created_at := now();
  END IF;

  IF NEW.created_at > (now() + interval '5 minutes') THEN
    RAISE EXCEPTION 'created_at is in the future';
  END IF;

  IF NEW.vehicle_id IS NOT NULL THEN
    SELECT id INTO v_vehicle_id FROM public.vehicles WHERE id = NEW.vehicle_id;
    IF v_vehicle_id IS NULL THEN
      RAISE EXCEPTION 'Vehicle % not found', NEW.vehicle_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS complaints_suggestions_validate ON public.complaints_suggestions;
CREATE TRIGGER complaints_suggestions_validate
BEFORE INSERT OR UPDATE OF message, created_at, vehicle_id
ON public.complaints_suggestions
FOR EACH ROW
EXECUTE FUNCTION public.validate_complaint_suggestion();
