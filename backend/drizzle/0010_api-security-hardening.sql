-- Security hardening for API schemas

CREATE OR REPLACE VIEW passenger_api.v_profile
WITH (security_barrier = true)
AS
SELECT u.id, u.login, u.full_name, u.email, u.phone, u.registered_at
FROM public.users u
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_card
WITH (security_barrier = true)
AS
SELECT tc.id,
       tc.card_number,
       tc.balance
FROM public.transport_cards tc
JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_card_top_ups
WITH (security_barrier = true)
AS
SELECT ctu.id,
       ctu.amount,
       ctu.topped_up_at,
       tc.card_number
FROM public.card_top_ups ctu
JOIN public.transport_cards tc ON tc.id = ctu.card_id
JOIN public.users u ON u.id = tc.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_tickets
WITH (security_barrier = true)
AS
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

CREATE OR REPLACE VIEW passenger_api.v_fines
WITH (security_barrier = true)
AS
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

CREATE OR REPLACE VIEW passenger_api.v_fine_appeals
WITH (security_barrier = true)
AS
SELECT fa.id,
       fa.fine_id,
       fa.status,
       fa.message,
       fa.created_at
FROM public.fine_appeals fa
JOIN public.fines f ON f.id = fa.fine_id
JOIN public.users u ON u.id = f.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_complaints
WITH (security_barrier = true)
AS
SELECT cs.id,
       cs.type,
       cs.message,
       cs.status,
       cs.trip_id,
       cs.created_at
FROM public.complaints_suggestions cs
JOIN public.users u ON u.id = cs.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW passenger_api.v_user_gps_logs
WITH (security_barrier = true)
AS
SELECT ulg.id,
       ulg.lon,
       ulg.lat,
       ulg.recorded_at
FROM public.user_gps_logs ulg
JOIN public.users u ON u.id = ulg.user_id
WHERE u.login = session_user;

CREATE OR REPLACE VIEW driver_api.v_profile
WITH (security_barrier = true)
AS
SELECT d.id,
       d.login,
       d.full_name,
       d.email,
       d.phone,
       d.driver_license_number,
       d.license_categories
FROM public.drivers d
WHERE d.login = session_user;

CREATE OR REPLACE VIEW driver_api.v_my_schedule
WITH (security_barrier = true)
AS
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

ALTER TABLE public.transport_cards FORCE ROW LEVEL SECURITY;
ALTER TABLE public.card_top_ups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.tickets FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fines FORCE ROW LEVEL SECURITY;
ALTER TABLE public.fine_appeals FORCE ROW LEVEL SECURITY;
ALTER TABLE public.complaints_suggestions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_gps_logs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.trips FORCE ROW LEVEL SECURITY;
