-- Recreate RLS policies using session_user

ALTER TABLE transport_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_top_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE fine_appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE complaints_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_gps_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

-- transport_cards
DROP POLICY IF EXISTS passenger_cards_select ON transport_cards;
CREATE POLICY passenger_cards_select
ON transport_cards
FOR SELECT
TO ct_passenger_role
USING (user_id = (SELECT id FROM users WHERE login = session_user));

DROP POLICY IF EXISTS passenger_cards_update ON transport_cards;
CREATE POLICY passenger_cards_update
ON transport_cards
FOR UPDATE
TO ct_passenger_role
USING (user_id = (SELECT id FROM users WHERE login = session_user))
WITH CHECK (user_id = (SELECT id FROM users WHERE login = session_user));

DROP POLICY IF EXISTS controller_cards_select ON transport_cards;
CREATE POLICY controller_cards_select
ON transport_cards
FOR SELECT
TO ct_controller_role, ct_migrator
USING (true);

DROP POLICY IF EXISTS admin_cards_all ON transport_cards;
CREATE POLICY admin_cards_all
ON transport_cards
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

-- card_top_ups
DROP POLICY IF EXISTS passenger_topups_select ON card_top_ups;
CREATE POLICY passenger_topups_select
ON card_top_ups
FOR SELECT
TO ct_passenger_role
USING (
  EXISTS (
    SELECT 1
    FROM transport_cards tc
    WHERE tc.id = card_top_ups.card_id
      AND tc.user_id = (SELECT id FROM users WHERE login = session_user)
  )
);

DROP POLICY IF EXISTS passenger_topups_insert ON card_top_ups;
CREATE POLICY passenger_topups_insert
ON card_top_ups
FOR INSERT
TO ct_passenger_role
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM transport_cards tc
    WHERE tc.id = card_top_ups.card_id
      AND tc.user_id = (SELECT id FROM users WHERE login = session_user)
  )
);

DROP POLICY IF EXISTS accountant_topups_select ON card_top_ups;
CREATE POLICY accountant_topups_select
ON card_top_ups
FOR SELECT
TO ct_accountant_role
USING (true);

DROP POLICY IF EXISTS admin_topups_all ON card_top_ups;
CREATE POLICY admin_topups_all
ON card_top_ups
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

-- tickets
DROP POLICY IF EXISTS passenger_tickets_select ON tickets;
CREATE POLICY passenger_tickets_select
ON tickets
FOR SELECT
TO ct_passenger_role
USING (
  EXISTS (
    SELECT 1
    FROM transport_cards tc
    WHERE tc.id = tickets.card_id
      AND tc.user_id = (SELECT id FROM users WHERE login = session_user)
  )
);

DROP POLICY IF EXISTS passenger_tickets_insert ON tickets;
CREATE POLICY passenger_tickets_insert
ON tickets
FOR INSERT
TO ct_passenger_role
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM transport_cards tc
    WHERE tc.id = tickets.card_id
      AND tc.user_id = (SELECT id FROM users WHERE login = session_user)
  )
);

DROP POLICY IF EXISTS accountant_tickets_select ON tickets;
CREATE POLICY accountant_tickets_select
ON tickets
FOR SELECT
TO ct_accountant_role
USING (true);

DROP POLICY IF EXISTS controller_tickets_select ON tickets;
CREATE POLICY controller_tickets_select
ON tickets
FOR SELECT
TO ct_controller_role
USING (true);

DROP POLICY IF EXISTS admin_tickets_all ON tickets;
CREATE POLICY admin_tickets_all
ON tickets
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

-- fines
DROP POLICY IF EXISTS passenger_fines_select ON fines;
CREATE POLICY passenger_fines_select
ON fines
FOR SELECT
TO ct_passenger_role
USING (user_id = (SELECT id FROM users WHERE login = session_user));

DROP POLICY IF EXISTS controller_fines_insert ON fines;
CREATE POLICY controller_fines_insert
ON fines
FOR INSERT
TO ct_controller_role, ct_migrator
WITH CHECK (true);

DROP POLICY IF EXISTS controller_fines_select ON fines;
CREATE POLICY controller_fines_select
ON fines
FOR SELECT
TO ct_controller_role
USING (true);

DROP POLICY IF EXISTS accountant_fines_select ON fines;
CREATE POLICY accountant_fines_select
ON fines
FOR SELECT
TO ct_accountant_role
USING (true);

DROP POLICY IF EXISTS admin_fines_all ON fines;
CREATE POLICY admin_fines_all
ON fines
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

-- fine_appeals
DROP POLICY IF EXISTS passenger_appeals_select ON fine_appeals;
CREATE POLICY passenger_appeals_select
ON fine_appeals
FOR SELECT
TO ct_passenger_role
USING (
  EXISTS (
    SELECT 1
    FROM fines f
    WHERE f.id = fine_appeals.fine_id
      AND f.user_id = (SELECT id FROM users WHERE login = session_user)
  )
);

DROP POLICY IF EXISTS passenger_appeals_insert ON fine_appeals;
CREATE POLICY passenger_appeals_insert
ON fine_appeals
FOR INSERT
TO ct_passenger_role
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM fines f
    WHERE f.id = fine_appeals.fine_id
      AND f.user_id = (SELECT id FROM users WHERE login = session_user)
  )
);

DROP POLICY IF EXISTS admin_appeals_all ON fine_appeals;
CREATE POLICY admin_appeals_all
ON fine_appeals
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

-- complaints_suggestions
DROP POLICY IF EXISTS passenger_complaints_select ON complaints_suggestions;
CREATE POLICY passenger_complaints_select
ON complaints_suggestions
FOR SELECT
TO ct_passenger_role
USING (user_id = (SELECT id FROM users WHERE login = session_user));

DROP POLICY IF EXISTS passenger_complaints_insert ON complaints_suggestions;
CREATE POLICY passenger_complaints_insert
ON complaints_suggestions
FOR INSERT
TO ct_passenger_role
WITH CHECK (user_id = (SELECT id FROM users WHERE login = session_user));

DROP POLICY IF EXISTS municipality_complaints_select ON complaints_suggestions;
CREATE POLICY municipality_complaints_select
ON complaints_suggestions
FOR SELECT
TO ct_municipality_role
USING (true);

DROP POLICY IF EXISTS admin_complaints_all ON complaints_suggestions;
CREATE POLICY admin_complaints_all
ON complaints_suggestions
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

-- user_gps_logs
DROP POLICY IF EXISTS passenger_gps_select ON user_gps_logs;
CREATE POLICY passenger_gps_select
ON user_gps_logs
FOR SELECT
TO ct_passenger_role
USING (user_id = (SELECT id FROM users WHERE login = session_user));

DROP POLICY IF EXISTS passenger_gps_insert ON user_gps_logs;
CREATE POLICY passenger_gps_insert
ON user_gps_logs
FOR INSERT
TO ct_passenger_role
WITH CHECK (user_id = (SELECT id FROM users WHERE login = session_user));

DROP POLICY IF EXISTS admin_gps_all ON user_gps_logs;
CREATE POLICY admin_gps_all
ON user_gps_logs
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

-- trips
DROP POLICY IF EXISTS driver_trips_select ON trips;
CREATE POLICY driver_trips_select
ON trips
FOR SELECT
TO ct_driver_role, ct_migrator
USING (driver_id = (SELECT id FROM drivers WHERE login = session_user));

DROP POLICY IF EXISTS driver_trips_update ON trips;
CREATE POLICY driver_trips_update
ON trips
FOR UPDATE
TO ct_driver_role, ct_migrator
USING (driver_id = (SELECT id FROM drivers WHERE login = session_user))
WITH CHECK (driver_id = (SELECT id FROM drivers WHERE login = session_user));

DROP POLICY IF EXISTS driver_trips_insert ON trips;
CREATE POLICY driver_trips_insert
ON trips
FOR INSERT
TO ct_driver_role, ct_migrator
WITH CHECK (driver_id = (SELECT id FROM drivers WHERE login = session_user));

DROP POLICY IF EXISTS controller_trips_select ON trips;
CREATE POLICY controller_trips_select
ON trips
FOR SELECT
TO ct_controller_role, ct_migrator
USING (true);

DROP POLICY IF EXISTS admin_trips_all ON trips;
CREATE POLICY admin_trips_all
ON trips
FOR ALL
TO ct_admin_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS dispatcher_trips_all ON trips;
CREATE POLICY dispatcher_trips_all
ON trips
FOR ALL
TO ct_dispatcher_role
USING (true)
WITH CHECK (true);
