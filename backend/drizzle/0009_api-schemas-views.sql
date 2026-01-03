-- API schemas for views/functions. Tables stay in public.

CREATE SCHEMA IF NOT EXISTS guest_api;
CREATE SCHEMA IF NOT EXISTS passenger_api;
CREATE SCHEMA IF NOT EXISTS controller_api;
CREATE SCHEMA IF NOT EXISTS dispatcher_api;
CREATE SCHEMA IF NOT EXISTS municipality_api;
CREATE SCHEMA IF NOT EXISTS accountant_api;
CREATE SCHEMA IF NOT EXISTS admin_api;
CREATE SCHEMA IF NOT EXISTS driver_api;

-- Guest/public views
CREATE OR REPLACE VIEW guest_api.v_stops AS
SELECT s.id, s.name, s.lon, s.lat
FROM public.stops s;

CREATE OR REPLACE VIEW guest_api.v_transport_types AS
SELECT tt.id, tt.name
FROM public.transport_types tt;

CREATE OR REPLACE VIEW guest_api.v_routes AS
SELECT r.id,
       r.number,
       r.direction,
       r.is_active,
       r.transport_type_id,
       tt.name AS transport_type
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id;

CREATE OR REPLACE VIEW guest_api.v_route_stops AS
SELECT rs.id,
       rs.route_id,
       rs.stop_id,
       s.name AS stop_name,
       rs.prev_route_stop_id,
       rs.next_route_stop_id,
       rs.distance_to_next_km
FROM public.route_stops rs
JOIN public.stops s ON s.id = rs.stop_id;

CREATE OR REPLACE VIEW guest_api.v_schedules AS
SELECT sc.id,
       sc.route_id,
       sc.work_start_time,
       sc.work_end_time,
       sc.interval_min
FROM public.schedules sc;

-- Passenger views (filtered by session_user)
CREATE OR REPLACE VIEW passenger_api.v_profile AS
SELECT u.id, u.login, u.full_name, u.email, u.phone, u.registered_at
FROM public.users u
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_card AS
SELECT tc.id,
       tc.card_number,
       tc.balance
FROM public.transport_cards tc
JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_card_top_ups AS
SELECT ctu.id,
       ctu.amount,
       ctu.topped_up_at,
       tc.card_number
FROM public.card_top_ups ctu
JOIN public.transport_cards tc ON tc.id = ctu.card_id
JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_tickets AS
SELECT t.id,
       t.price,
       t.purchased_at,
       tc.card_number,
       tr.id AS trip_id,
       r.number AS route_number,
       r.direction,
       v.fleet_number,
       tt.name AS transport_type
FROM public.tickets t
JOIN public.transport_cards tc ON tc.id = t.card_id
JOIN public.users u ON u.id = tc.user_id
JOIN public.trips tr ON tr.id = t.trip_id
JOIN public.routes r ON r.id = tr.route_id
JOIN public.vehicles v ON v.id = tr.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_fines AS
SELECT f.id,
       f.amount,
       f.status,
       f.reason,
       f.issued_by,
       f.issued_at,
       tr.id AS trip_id,
       r.number AS route_number,
       r.direction,
       v.fleet_number,
       tt.name AS transport_type
FROM public.fines f
JOIN public.users u ON u.id = f.user_id
JOIN public.trips tr ON tr.id = f.trip_id
JOIN public.routes r ON r.id = tr.route_id
JOIN public.vehicles v ON v.id = tr.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_fine_appeals AS
SELECT fa.id,
       fa.fine_id,
       fa.status,
       fa.message,
       fa.created_at
FROM public.fine_appeals fa
JOIN public.fines f ON f.id = fa.fine_id
JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_complaints AS
SELECT cs.id,
       cs.type,
       cs.message,
       cs.status,
       cs.trip_id,
       cs.created_at
FROM public.complaints_suggestions cs
JOIN public.users u ON u.id = cs.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_user_gps_logs AS
SELECT ulg.id,
       ulg.lon,
       ulg.lat,
       ulg.recorded_at
FROM public.user_gps_logs ulg
JOIN public.users u ON u.id = ulg.user_id
WHERE u.login = session_user;

-- Controller views
CREATE OR REPLACE VIEW controller_api.v_cards AS
SELECT tc.id,
       tc.card_number,
       tc.balance,
       u.id AS user_id,
       u.full_name,
       u.phone,
       u.email
FROM public.transport_cards tc
JOIN public.users u ON u.id = tc.user_id;

CREATE OR REPLACE VIEW controller_api.v_card_last_trip AS
SELECT DISTINCT ON (tc.id)
       tc.card_number,
       t.id AS ticket_id,
       tr.id AS trip_id,
       tr.starts_at,
       tr.ends_at,
       r.number AS route_number,
       r.direction,
       v.fleet_number
FROM public.transport_cards tc
JOIN public.tickets t ON t.card_id = tc.id
JOIN public.trips tr ON tr.id = t.trip_id
JOIN public.routes r ON r.id = tr.route_id
JOIN public.vehicles v ON v.id = tr.vehicle_id
ORDER BY tc.id, tr.starts_at DESC;

-- Driver views
CREATE OR REPLACE VIEW driver_api.v_profile AS
SELECT d.id,
       d.login,
       d.full_name,
       d.email,
       d.phone,
       d.driver_license_number,
       d.license_categories
FROM public.drivers d
WHERE d.login = session_user;

CREATE OR REPLACE VIEW driver_api.v_my_schedule AS
SELECT t.id,
       t.starts_at,
       t.ends_at,
       r.number AS route_number,
       r.direction,
       v.fleet_number,
       tt.name AS transport_type
FROM public.trips t
JOIN public.drivers d ON d.id = t.driver_id
JOIN public.routes r ON r.id = t.route_id
JOIN public.vehicles v ON v.id = t.vehicle_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
WHERE d.login = session_user
ORDER BY t.starts_at;

-- Dispatcher views
CREATE OR REPLACE VIEW dispatcher_api.v_schedules AS
SELECT sc.id,
       sc.route_id,
       r.number AS route_number,
       r.direction,
       sc.work_start_time,
       sc.work_end_time,
       sc.interval_min
FROM public.schedules sc
JOIN public.routes r ON r.id = sc.route_id;

CREATE OR REPLACE VIEW dispatcher_api.v_driver_assignments AS
SELECT a.id,
       d.id AS driver_id,
       d.full_name,
       d.login,
       v.id AS vehicle_id,
       v.fleet_number,
       r.number AS route_number,
       r.direction
FROM public.driver_vehicle_assignments a
JOIN public.drivers d ON d.id = a.driver_id
JOIN public.vehicles v ON v.id = a.vehicle_id
JOIN public.routes r ON r.id = v.route_id;

-- Municipality views
CREATE OR REPLACE VIEW municipality_api.v_routes AS
SELECT r.id,
       r.number,
       r.direction,
       r.is_active,
       tt.name AS transport_type
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id;

CREATE OR REPLACE VIEW municipality_api.v_route_points AS
SELECT rp.id,
       rp.route_id,
       rp.lon,
       rp.lat,
       rp.prev_route_point_id,
       rp.next_route_point_id
FROM public.route_points rp;

-- Accountant views
CREATE OR REPLACE VIEW accountant_api.v_revenue_items AS
SELECT 'ticket'::text AS source,
       t.id AS source_id,
       t.price AS amount,
       t.purchased_at AS occurred_at
FROM public.tickets t
UNION ALL
SELECT 'top_up'::text AS source,
       ctu.id AS source_id,
       ctu.amount AS amount,
       ctu.topped_up_at AS occurred_at
FROM public.card_top_ups ctu
UNION ALL
SELECT 'fine'::text AS source,
       f.id AS source_id,
       f.amount AS amount,
       f.issued_at AS occurred_at
FROM public.fines f;

CREATE OR REPLACE VIEW accountant_api.v_expenses AS
SELECT e.id,
       e.category,
       e.amount,
       e.description,
       e.occurred_at,
       e.document_ref
FROM public.expenses e;

-- Admin view
CREATE OR REPLACE VIEW admin_api.v_system_stats AS
SELECT
  (SELECT COUNT(*) FROM public.users) AS users_count,
  (SELECT COUNT(*) FROM public.drivers) AS drivers_count,
  (SELECT COUNT(*) FROM public.vehicles) AS vehicles_count,
  (SELECT COUNT(*) FROM public.routes) AS routes_count,
  (SELECT COUNT(*) FROM public.trips) AS trips_count;

-- Grants (guarded in case roles are created separately)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_guest_role') THEN
    GRANT USAGE ON SCHEMA guest_api TO ct_guest_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api TO ct_guest_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_passenger_role') THEN
    GRANT USAGE ON SCHEMA guest_api, passenger_api TO ct_passenger_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api, passenger_api TO ct_passenger_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_controller_role') THEN
    GRANT USAGE ON SCHEMA guest_api, controller_api TO ct_controller_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api, controller_api TO ct_controller_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_driver_role') THEN
    GRANT USAGE ON SCHEMA guest_api, driver_api TO ct_driver_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api, driver_api TO ct_driver_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_dispatcher_role') THEN
    GRANT USAGE ON SCHEMA guest_api, dispatcher_api TO ct_dispatcher_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api, dispatcher_api TO ct_dispatcher_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_municipality_role') THEN
    GRANT USAGE ON SCHEMA guest_api, municipality_api TO ct_municipality_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api, municipality_api TO ct_municipality_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_accountant_role') THEN
    GRANT USAGE ON SCHEMA guest_api, accountant_api TO ct_accountant_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api, accountant_api TO ct_accountant_role;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ct_admin_role') THEN
    GRANT USAGE ON SCHEMA guest_api,
      passenger_api,
      controller_api,
      dispatcher_api,
      municipality_api,
      accountant_api,
      admin_api,
      driver_api
    TO ct_admin_role;
    GRANT SELECT ON ALL TABLES IN SCHEMA guest_api,
      passenger_api,
      controller_api,
      dispatcher_api,
      municipality_api,
      accountant_api,
      admin_api,
      driver_api
    TO ct_admin_role;
  END IF;
END $$;
