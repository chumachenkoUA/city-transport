-- 0022_passenger_pay_fine.sql

CREATE OR REPLACE FUNCTION passenger_api.pay_fine(
    p_fine_id bigint,
    p_card_id bigint
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    v_user_id bigint;
    v_fine_user_id bigint;
    v_fine_amount numeric;
    v_fine_status text;
    v_card_user_id bigint;
    v_card_balance numeric;
BEGIN
    -- Get current user ID
    SELECT id INTO v_user_id FROM public.users WHERE login = session_user;
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not found'; END IF;

    -- Check Fine
    SELECT user_id, amount, status INTO v_fine_user_id, v_fine_amount, v_fine_status
    FROM public.fines WHERE id = p_fine_id;

    IF v_fine_user_id IS NULL THEN RAISE EXCEPTION 'Fine not found'; END IF;
    IF v_fine_user_id != v_user_id THEN RAISE EXCEPTION 'Not your fine'; END IF;
    IF v_fine_status = 'Сплачено' THEN RAISE EXCEPTION 'Fine is already paid'; END IF;

    -- Check Card
    SELECT user_id, balance INTO v_card_user_id, v_card_balance
    FROM public.transport_cards WHERE id = p_card_id;

    IF v_card_user_id IS NULL THEN RAISE EXCEPTION 'Card not found'; END IF;
    IF v_card_user_id != v_user_id THEN RAISE EXCEPTION 'Not your card'; END IF;
    IF v_card_balance < v_fine_amount THEN RAISE EXCEPTION 'Insufficient balance on card'; END IF;

    -- Perform Transaction
    UPDATE public.transport_cards SET balance = balance - v_fine_amount WHERE id = p_card_id;
    UPDATE public.fines SET status = 'Сплачено' WHERE id = p_fine_id;

    -- Ideally we should record a transaction log here, but for now this is sufficient per requirements
END;
$$;

GRANT EXECUTE ON FUNCTION passenger_api.pay_fine(bigint, bigint) TO ct_passenger_role;
