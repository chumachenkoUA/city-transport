-- 0006_security_hardening.sql

-- 1. Enable RLS
ALTER TABLE transport_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_top_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gps_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- 2. RLS Policies
CREATE POLICY passenger_cards_select ON transport_cards FOR SELECT TO ct_passenger_role USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY staff_cards_select ON transport_cards FOR SELECT TO ct_controller_role, ct_dispatcher_role USING (true);
CREATE POLICY admin_cards_all ON transport_cards FOR ALL TO ct_admin_role USING (true) WITH CHECK (true);

CREATE POLICY passenger_topups_select ON card_top_ups FOR SELECT TO ct_passenger_role USING (EXISTS (SELECT 1 FROM transport_cards tc WHERE tc.id = card_top_ups.card_id AND tc.user_id = (SELECT id FROM users WHERE login = session_user)));
CREATE POLICY staff_topups_select ON card_top_ups FOR SELECT TO ct_accountant_role USING (true);

CREATE POLICY passenger_tickets_select ON tickets FOR SELECT TO ct_passenger_role USING (EXISTS (SELECT 1 FROM transport_cards tc WHERE tc.id = tickets.card_id AND tc.user_id = (SELECT id FROM users WHERE login = session_user)));
CREATE POLICY staff_tickets_select ON tickets FOR SELECT TO ct_controller_role, ct_accountant_role USING (true);

CREATE POLICY passenger_fines_select ON fines FOR SELECT TO ct_passenger_role USING (user_id = (SELECT id FROM users WHERE login = session_user));
CREATE POLICY staff_fines_select ON fines FOR SELECT TO ct_controller_role, ct_accountant_role, ct_admin_role USING (true);

CREATE POLICY driver_trips_select ON trips FOR SELECT TO ct_driver_role USING (driver_id = (SELECT id FROM drivers WHERE login = session_user));
CREATE POLICY staff_trips_select ON trips FOR SELECT TO ct_dispatcher_role, ct_admin_role USING (true);

-- 3. Final REVOKE (Thick Database principle: No direct public table access)
DO $$
DECLARE
    role_name text;
BEGIN
    FOREACH role_name IN ARRAY ARRAY[
        'ct_guest_role', 'ct_passenger_role', 'ct_driver_role', 'ct_dispatcher_role',
        'ct_controller_role', 'ct_manager_role', 'ct_municipality_role', 'ct_accountant_role'
    ]
    LOOP
        EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', role_name);
        EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', role_name);
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', role_name);
    END LOOP;
END $$;

-- 4. Re-grant CONNECT to ensure accessibility
GRANT CONNECT ON DATABASE city_transport TO PUBLIC;
