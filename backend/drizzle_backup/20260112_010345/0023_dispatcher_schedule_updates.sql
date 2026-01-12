-- 0023_dispatcher_schedule_updates.sql

-- Add vehicle link to schedules for dispatcher workflows
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS vehicle_id bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'schedules_vehicle_id_vehicles_id_fk'
  ) THEN
    ALTER TABLE public.schedules
      ADD CONSTRAINT schedules_vehicle_id_vehicles_id_fk
      FOREIGN KEY (vehicle_id)
      REFERENCES public.vehicles(id)
      ON DELETE SET NULL;
  END IF;
END $$;

-- Dispatcher views with vehicle + direction
DROP VIEW IF EXISTS dispatcher_api.v_schedules_list;
DROP VIEW IF EXISTS dispatcher_api.v_vehicle_monitoring;
CREATE OR REPLACE VIEW dispatcher_api.v_schedules_list AS
SELECT
  s.id,
  s.route_id,
  r.number as route_number,
  r.direction as direction,
  tt.name as transport_type,
  s.work_start_time,
  s.work_end_time,
  s.interval_min,
  s.vehicle_id,
  v.fleet_number
FROM public.schedules s
JOIN public.routes r ON r.id = s.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicles v ON v.id = s.vehicle_id;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_monitoring AS
SELECT
  v.id,
  v.fleet_number,
  v.route_id,
  r.number as route_number,
  r.direction as direction,
  tt.name as transport_type,
  v.last_lon,
  v.last_lat,
  v.last_recorded_at,
  CASE WHEN v.last_recorded_at > (now() - interval '5 minutes')
    THEN 'active'
    ELSE 'inactive'
  END as status,
  d.full_name as current_driver_name
FROM public.vehicles v
JOIN public.routes r ON r.id = v.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.trips t ON t.vehicle_id = v.id AND t.ends_at IS NULL
LEFT JOIN public.drivers d ON d.id = t.driver_id;

-- Guest schedule view now exposes vehicle_id (optional)
DROP VIEW IF EXISTS guest_api.v_schedules;
CREATE OR REPLACE VIEW guest_api.v_schedules AS
SELECT
  route_id,
  work_start_time,
  work_end_time,
  interval_min,
  monday,
  tuesday,
  wednesday,
  thursday,
  friday,
  saturday,
  sunday,
  valid_from,
  valid_to,
  vehicle_id
FROM public.schedules;

-- Dispatcher functions with vehicle linkage
CREATE OR REPLACE FUNCTION dispatcher_api.create_schedule_v3(
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

CREATE OR REPLACE FUNCTION dispatcher_api.update_schedule_v2(
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

GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule_v3(bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule_v2(bigint, bigint, bigint, time, time, integer)
  TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_schedules_list TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_vehicle_monitoring TO ct_dispatcher_role;
