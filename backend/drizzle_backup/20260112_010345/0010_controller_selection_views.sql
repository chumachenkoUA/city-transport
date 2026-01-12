-- Custom SQL migration file, put your code below! --
CREATE OR REPLACE VIEW controller_api.v_routes AS
SELECT DISTINCT ON (r.number, tt.name)
    r.id,
    r.number,
    tt.name as transport_type
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE r.is_active = true
ORDER BY r.number, tt.name, r.id;

CREATE OR REPLACE VIEW controller_api.v_vehicles AS
SELECT
    v.id,
    v.fleet_number,
    r.id as route_id,
    r.number as route_number,
    tt.name as transport_type,
    vm.name as model_name
FROM public.vehicles v
LEFT JOIN public.routes r ON r.id = v.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicle_models vm ON vm.id = v.vehicle_model_id;

GRANT SELECT ON controller_api.v_routes TO ct_controller_role;
GRANT SELECT ON controller_api.v_vehicles TO ct_controller_role;
