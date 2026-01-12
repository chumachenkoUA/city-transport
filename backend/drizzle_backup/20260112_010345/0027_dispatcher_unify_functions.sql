-- 0027_dispatcher_unify_functions.sql

-- Remove legacy dispatcher functions.
DROP FUNCTION IF EXISTS dispatcher_api.create_schedule_v2(text, text, time, time, integer);
DROP FUNCTION IF EXISTS dispatcher_api.update_schedule(bigint, time, time, integer);
DROP FUNCTION IF EXISTS dispatcher_api.create_schedule_v3(bigint, bigint, time, time, integer);
DROP FUNCTION IF EXISTS dispatcher_api.update_schedule_v2(bigint, bigint, bigint, time, time, integer);

-- Unified dispatcher schedule APIs.
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule(
  p_route_id bigint,
  p_vehicle_id bigint,
  p_start time,
  p_end time,
  p_interval integer
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE v_id bigint;
BEGIN
  INSERT INTO public.schedules (route_id, vehicle_id, work_start_time, work_end_time, interval_min)
  VALUES (p_route_id, p_vehicle_id, p_start, p_end, p_interval)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule(
  p_schedule_id bigint,
  p_route_id bigint DEFAULT NULL,
  p_vehicle_id bigint DEFAULT NULL,
  p_start time DEFAULT NULL,
  p_end time DEFAULT NULL,
  p_interval integer DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  UPDATE public.schedules
  SET route_id = COALESCE(p_route_id, route_id),
      vehicle_id = COALESCE(p_vehicle_id, vehicle_id),
      work_start_time = COALESCE(p_start, work_start_time),
      work_end_time = COALESCE(p_end, work_end_time),
      interval_min = COALESCE(p_interval, interval_min)
  WHERE id = p_schedule_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule(bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule(bigint, bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
