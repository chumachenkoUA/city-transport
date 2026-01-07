-- 0010_driver_api_refinements.sql

-- Видаляємо старе view, щоб уникнути помилки "cannot change name of view column" при зміні порядку стовпців
DROP VIEW IF EXISTS driver_api.v_my_schedule CASCADE;

-- Оновлюємо view розкладу водія, додаючи passenger_count (Вимога 4 - контроль введених даних)
CREATE OR REPLACE VIEW driver_api.v_my_schedule WITH (security_barrier = true) AS
SELECT 
    t.id, 
    t.starts_at, 
    t.ends_at, 
    t.passenger_count,
    t.route_id, 
    r.number AS route_number, 
    r.direction,
    r.transport_type_id, 
    tt.name AS transport_type, 
    t.vehicle_id, 
    v.fleet_number
FROM public.trips t
         JOIN public.drivers d ON d.id = t.driver_id
         JOIN public.routes r ON r.id = t.route_id
         JOIN public.vehicles v ON v.id = t.vehicle_id
         JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY t.starts_at;

GRANT SELECT ON driver_api.v_my_schedule TO ct_driver_role;