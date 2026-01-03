-- Dispatcher API: active trips, assignments, and GPS logs

CREATE OR REPLACE VIEW dispatcher_api.v_active_trips
WITH (security_barrier = true)
AS
SELECT t.id,
       t.route_id,
       r.number AS route_number,
       r.direction,
       r.transport_type_id,
       tt.name AS transport_type,
       t.vehicle_id,
       v.fleet_number,
       t.driver_id,
       d.full_name AS driver_name,
       d.login AS driver_login,
       t.starts_at,
       t.ends_at
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.drivers d ON d.id = t.driver_id
WHERE t.starts_at <= now()
  AND (t.ends_at IS NULL OR t.ends_at >= now());

CREATE OR REPLACE VIEW dispatcher_api.v_assignments
WITH (security_barrier = true)
AS
SELECT a.id,
       a.driver_id,
       d.full_name AS driver_name,
       d.login AS driver_login,
       d.phone AS driver_phone,
       a.vehicle_id,
       v.fleet_number,
       v.route_id,
       r.number AS route_number,
       r.direction,
       r.transport_type_id,
       tt.name AS transport_type,
       a.assigned_at
FROM public.driver_vehicle_assignments a
JOIN public.drivers d ON d.id = a.driver_id
JOIN public.vehicles v ON v.id = a.vehicle_id
JOIN public.routes r ON r.id = v.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id;

CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_gps_logs
WITH (security_barrier = true)
AS
SELECT l.id,
       l.vehicle_id,
       l.lon,
       l.lat,
       l.recorded_at
FROM public.vehicle_gps_logs l;

DO $$
BEGIN
  IF to_regrole('ct_dispatcher_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON dispatcher_api.v_active_trips TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON dispatcher_api.v_assignments TO ct_dispatcher_role';
    EXECUTE 'GRANT SELECT ON dispatcher_api.v_vehicle_gps_logs TO ct_dispatcher_role';
  END IF;
END $$;
