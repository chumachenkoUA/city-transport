-- 0036_controller_trip_lookup.sql

CREATE OR REPLACE FUNCTION controller_api.get_active_trips(
  p_fleet_number text,
  p_checked_at timestamp DEFAULT now()
)
RETURNS TABLE (
  trip_id bigint,
  starts_at timestamp,
  ends_at timestamp,
  route_number text,
  transport_type text,
  driver_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.starts_at,
    t.ends_at,
    r.number,
    tt.name,
    d.full_name
  FROM public.trips t
  JOIN public.vehicles v ON v.id = t.vehicle_id
  JOIN public.routes r ON r.id = t.route_id
  JOIN public.transport_types tt ON tt.id = r.transport_type_id
  JOIN public.drivers d ON d.id = t.driver_id
  WHERE v.fleet_number = p_fleet_number
    AND t.starts_at <= p_checked_at
    AND (t.ends_at IS NULL OR t.ends_at >= p_checked_at)
  ORDER BY t.starts_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION controller_api.issue_fine(
  p_card text,
  p_amt numeric,
  p_reason text,
  p_fleet text DEFAULT NULL,
  p_time timestamp DEFAULT now(),
  p_trip_id bigint DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_u_id bigint;
  v_t_id bigint;
  v_vehicle_id bigint;
  v_f_id bigint;
BEGIN
  SELECT user_id INTO v_u_id
  FROM public.transport_cards
  WHERE card_number = p_card;

  IF v_u_id IS NULL THEN
    RAISE EXCEPTION 'Card % not found', p_card;
  END IF;

  IF p_trip_id IS NOT NULL THEN
    SELECT t.id, t.vehicle_id
    INTO v_t_id, v_vehicle_id
    FROM public.trips t
    WHERE t.id = p_trip_id;

    IF v_t_id IS NULL THEN
      RAISE EXCEPTION 'Trip % not found', p_trip_id;
    END IF;

    IF p_fleet IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.vehicles v
        WHERE v.id = v_vehicle_id
          AND v.fleet_number = p_fleet
      ) THEN
        RAISE EXCEPTION 'Trip % does not match vehicle %', p_trip_id, p_fleet;
      END IF;
    END IF;
  ELSE
    IF p_fleet IS NOT NULL THEN
      SELECT t.id INTO v_t_id
      FROM public.trips t
      JOIN public.vehicles v ON v.id = t.vehicle_id
      WHERE v.fleet_number = p_fleet
        AND t.starts_at <= p_time
        AND (t.ends_at IS NULL OR t.ends_at >= p_time)
      ORDER BY t.starts_at DESC
      LIMIT 1;
    END IF;
  END IF;

  INSERT INTO public.fines (user_id, amount, reason, status, trip_id, issued_at)
  VALUES (v_u_id, p_amt, p_reason, 'Очікує сплати', v_t_id, p_time)
  RETURNING id INTO v_f_id;

  RETURN v_f_id;
END;
$$;

GRANT EXECUTE ON FUNCTION controller_api.get_active_trips(text, timestamp)
  TO ct_controller_role;
GRANT EXECUTE ON FUNCTION controller_api.issue_fine(text, numeric, text, text, timestamp, bigint)
  TO ct_controller_role;
