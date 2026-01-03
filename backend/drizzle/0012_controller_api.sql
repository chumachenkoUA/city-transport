-- Controller API: views and functions using controller_api schema

DROP VIEW IF EXISTS controller_api.v_card_last_trip;
DROP VIEW IF EXISTS controller_api.v_active_trips;

CREATE OR REPLACE VIEW controller_api.v_card_last_trip AS
SELECT DISTINCT ON (tc.id)
       tc.id AS card_id,
       tc.card_number,
       t.id AS ticket_id,
       t.purchased_at,
       tr.id AS trip_id,
       tr.route_id,
       tr.vehicle_id,
       tr.driver_id,
       r.number AS route_number,
       r.direction,
       tt.name AS transport_type,
       v.fleet_number
FROM public.transport_cards tc
JOIN public.tickets t ON t.card_id = tc.id
JOIN public.trips tr ON tr.id = t.trip_id
JOIN public.routes r ON r.id = tr.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
JOIN public.vehicles v ON v.id = tr.vehicle_id
ORDER BY tc.id, t.purchased_at DESC;

CREATE OR REPLACE VIEW controller_api.v_active_trips AS
SELECT tr.id AS trip_id,
       tr.route_id,
       r.number AS route_number,
       r.direction,
       tr.vehicle_id,
       v.fleet_number,
       tr.driver_id,
       tr.starts_at,
       tr.ends_at,
       tt.name AS transport_type
FROM public.trips tr
JOIN public.routes r ON r.id = tr.route_id
JOIN public.vehicles v ON v.id = tr.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE tr.starts_at <= now()
  AND (tr.ends_at IS NULL OR tr.ends_at >= now());

CREATE OR REPLACE FUNCTION controller_api.issue_fine(
  p_card_number text,
  p_amount numeric,
  p_reason text,
  p_status text DEFAULT 'Очікує сплати',
  p_trip_id bigint DEFAULT NULL,
  p_fleet_number text DEFAULT NULL,
  p_route_number text DEFAULT NULL,
  p_checked_at timestamp DEFAULT now(),
  p_issued_at timestamp DEFAULT now()
) RETURNS TABLE (
  id bigint,
  user_id bigint,
  status text,
  amount numeric,
  reason text,
  issued_by text,
  trip_id bigint,
  issued_at timestamp
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_user_id bigint;
  v_trip_id bigint;
  v_checked_at timestamp;
  v_issued_at timestamp;
BEGIN
  IF NOT (
    pg_has_role(session_user, 'ct_controller_role', 'member') OR
    pg_has_role(session_user, 'ct_admin_role', 'member')
  ) THEN
    RAISE EXCEPTION 'insufficient role for issuing fines';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be greater than 0';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'reason must not be empty';
  END IF;

  SELECT tc.user_id
  INTO v_user_id
  FROM transport_cards tc
  WHERE tc.card_number = p_card_number;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'card % not found', p_card_number;
  END IF;

  v_checked_at := COALESCE(p_checked_at, now());
  v_issued_at := COALESCE(p_issued_at, v_checked_at);

  IF p_trip_id IS NULL THEN
    IF p_fleet_number IS NULL THEN
      RAISE EXCEPTION 'trip_id or fleet_number must be provided';
    END IF;

    SELECT tr.id
    INTO v_trip_id
    FROM trips tr
    JOIN vehicles v ON v.id = tr.vehicle_id
    JOIN routes r ON r.id = tr.route_id
    WHERE v.fleet_number = p_fleet_number
      AND tr.starts_at <= v_checked_at
      AND (tr.ends_at IS NULL OR tr.ends_at >= v_checked_at)
      AND (p_route_number IS NULL OR r.number = p_route_number)
    ORDER BY tr.starts_at DESC
    LIMIT 1;
  ELSE
    v_trip_id := p_trip_id;
  END IF;

  IF v_trip_id IS NULL THEN
    RAISE EXCEPTION 'active trip not found for provided criteria';
  END IF;

  RETURN QUERY
  INSERT INTO fines (user_id, status, amount, reason, issued_by, trip_id, issued_at)
  VALUES (
    v_user_id,
    COALESCE(p_status, 'Очікує сплати'),
    p_amount,
    p_reason,
    session_user,
    v_trip_id,
    v_issued_at
  )
  RETURNING id, user_id, status, amount, reason, issued_by, trip_id, issued_at;
END;
$$;

REVOKE ALL ON FUNCTION controller_api.issue_fine(
  text,
  numeric,
  text,
  text,
  bigint,
  text,
  text,
  timestamp,
  timestamp
) FROM PUBLIC;

DO $$
BEGIN
  IF to_regrole('ct_controller_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON controller_api.v_card_last_trip TO ct_controller_role';
    EXECUTE 'GRANT SELECT ON controller_api.v_active_trips TO ct_controller_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION controller_api.issue_fine(text, numeric, text, text, bigint, text, text, timestamp, timestamp) TO ct_controller_role';
  END IF;
END $$;
