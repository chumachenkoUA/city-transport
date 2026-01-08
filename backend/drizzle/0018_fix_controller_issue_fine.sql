-- 0018_fix_controller_issue_fine.sql

CREATE OR REPLACE FUNCTION controller_api.issue_fine(
    p_card text,
    p_amt numeric,
    p_reason text,
    p_fleet text DEFAULT NULL
)
    RETURNS bigint
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public AS $$
DECLARE
    v_u_id bigint;
    v_t_id bigint;
    v_f_id bigint;
BEGIN
    SELECT user_id INTO v_u_id FROM public.transport_cards WHERE card_number = p_card;
    IF p_fleet IS NOT NULL THEN
        SELECT t.id INTO v_t_id
        FROM public.trips t
                 JOIN public.vehicles v ON v.id = t.vehicle_id
        WHERE v.fleet_number = p_fleet AND t.ends_at IS NULL
        ORDER BY t.starts_at DESC LIMIT 1;
    END IF;
    INSERT INTO public.fines (user_id, amount, reason, status, trip_id, issued_at)
    VALUES (v_u_id, p_amt, p_reason, 'Очікує сплати', v_t_id, now())
    RETURNING id INTO v_f_id;
    RETURN v_f_id;
END;
$$;

GRANT EXECUTE ON FUNCTION controller_api.issue_fine(text, numeric, text, text) TO ct_controller_role;
