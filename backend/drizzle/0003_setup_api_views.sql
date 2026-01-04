-- 0003_setup_api_views.sql

-- GUEST API
CREATE OR REPLACE VIEW guest_api.v_transport_types AS SELECT id, name FROM public.transport_types;
CREATE OR REPLACE VIEW guest_api.v_stops AS SELECT id, name, lon, lat FROM public.stops;
CREATE OR REPLACE VIEW guest_api.v_routes AS
SELECT r.id, r.number, r.direction, r.transport_type_id, tt.name AS transport_type_name
FROM public.routes r JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE r.is_active = true;
CREATE OR REPLACE VIEW guest_api.v_route_stops AS
SELECT rs.id, rs.route_id, rs.stop_id, s.name AS stop_name, s.lon, s.lat, rs.distance_to_next_km, rs.prev_route_stop_id, rs.next_route_stop_id
FROM public.route_stops rs JOIN public.stops s ON s.id = rs.stop_id;
CREATE OR REPLACE VIEW guest_api.v_route_points AS SELECT * FROM public.route_points;
CREATE OR REPLACE VIEW guest_api.v_schedules AS SELECT route_id, work_start_time, work_end_time, interval_min FROM public.schedules;

-- DRIVER API
CREATE OR REPLACE VIEW driver_api.v_profile AS
SELECT id, login, full_name, email, phone, driver_license_number, license_categories
FROM public.drivers WHERE login = session_user;

CREATE OR REPLACE VIEW driver_api.v_my_schedule WITH (security_barrier = true) AS
SELECT t.id, t.starts_at, t.ends_at, t.route_id, r.number AS route_number, r.direction,
       r.transport_type_id, tt.name AS transport_type, t.vehicle_id, v.fleet_number
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY t.starts_at;

-- DISPATCHER (Minimal)
CREATE OR REPLACE VIEW dispatcher_api.v_active_trips AS
SELECT t.id, t.starts_at, d.full_name, v.fleet_number, r.number AS route_number
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.routes r ON r.id = t.route_id
WHERE t.ends_at IS NULL;

-- GRANTS
GRANT SELECT ON ALL TABLES IN SCHEMA guest_api TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;
GRANT SELECT ON driver_api.v_profile TO ct_driver_role;
GRANT SELECT ON driver_api.v_my_schedule TO ct_driver_role;
GRANT SELECT ON dispatcher_api.v_active_trips TO ct_dispatcher_role;
