-- 0012_dispatcher_fix_views.sql

-- View для списку транспорту
CREATE OR REPLACE VIEW dispatcher_api.v_vehicles_list AS
SELECT
    v.id,
    v.fleet_number,
    v.route_id,
    r.number as route_number,
    v.vehicle_model_id,
    vm.capacity
FROM public.vehicles v
         LEFT JOIN public.routes r ON r.id = v.route_id
         LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

-- View для історії призначень
CREATE OR REPLACE VIEW dispatcher_api.v_assignments_history AS
SELECT
    dva.id,
    dva.driver_id,
    d.full_name as driver_name,
    d.login as driver_login,
    d.phone as driver_phone,
    dva.vehicle_id,
    v.fleet_number,
    v.route_id,
    r.number as route_number,
    r.direction,
    tt.id as transport_type_id,
    tt.name as transport_type,
    dva.assigned_at
FROM public.driver_vehicle_assignments dva
         JOIN public.drivers d ON d.id = dva.driver_id
         JOIN public.vehicles v ON v.id = dva.vehicle_id
         LEFT JOIN public.routes r ON r.id = v.route_id
         LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id;

-- View для GPS логів (останні)
CREATE OR REPLACE VIEW dispatcher_api.v_vehicle_gps_logs AS
SELECT
    vgl.vehicle_id,
    vgl.lon,
    vgl.lat,
    vgl.recorded_at
FROM public.vehicle_gps_logs vgl;

-- GRANTS
GRANT SELECT ON dispatcher_api.v_vehicles_list TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_assignments_history TO ct_dispatcher_role;
GRANT SELECT ON dispatcher_api.v_vehicle_gps_logs TO ct_dispatcher_role;
