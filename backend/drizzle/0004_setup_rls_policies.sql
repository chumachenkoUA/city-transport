-- 0004_setup_rls_policies.sql

-- 1. Enable RLS
ALTER TABLE transport_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_top_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gps_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- 2. Transport Cards Policies
CREATE POLICY passenger_cards_select ON transport_cards FOR SELECT TO ct_passenger_role
    USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY controller_cards_select ON transport_cards FOR SELECT TO ct_controller_role USING (true);
CREATE POLICY admin_cards_all ON transport_cards FOR ALL TO ct_admin_role USING (true) WITH CHECK (true);

-- 3. Top Ups Policies
CREATE POLICY passenger_topups_select ON card_top_ups FOR SELECT TO ct_passenger_role
    USING (EXISTS (SELECT 1 FROM transport_cards tc WHERE tc.id = card_top_ups.card_id AND tc.user_id = (SELECT id FROM users WHERE login = session_user)));
CREATE POLICY accountant_topups_select ON card_top_ups FOR SELECT TO ct_accountant_role USING (true);
CREATE POLICY admin_topups_all ON card_top_ups FOR ALL TO ct_admin_role USING (true) WITH CHECK (true);

-- 4. Tickets Policies
CREATE POLICY passenger_tickets_select ON tickets FOR SELECT TO ct_passenger_role
    USING (EXISTS (SELECT 1 FROM transport_cards tc WHERE tc.id = tickets.card_id AND tc.user_id = (SELECT id FROM users WHERE login = session_user)));
CREATE POLICY staff_tickets_select ON tickets FOR SELECT TO ct_controller_role, ct_accountant_role USING (true);
CREATE POLICY admin_tickets_all ON tickets FOR ALL TO ct_admin_role USING (true) WITH CHECK (true);

-- 5. Fines Policies
CREATE POLICY passenger_fines_select ON fines FOR SELECT TO ct_passenger_role
    USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY staff_fines_select ON fines FOR SELECT TO ct_controller_role, ct_accountant_role USING (true);
CREATE POLICY admin_fines_all ON fines FOR ALL TO ct_admin_role USING (true) WITH CHECK (true);

-- 6. Trips Policies
CREATE POLICY driver_trips_select ON trips FOR SELECT TO ct_driver_role
    USING (driver_id = (SELECT id FROM drivers WHERE login = session_user));
CREATE POLICY dispatcher_trips_select ON trips FOR SELECT TO ct_dispatcher_role USING (true);
CREATE POLICY admin_trips_all ON trips FOR ALL TO ct_admin_role USING (true) WITH CHECK (true);
