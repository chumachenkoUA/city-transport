-- 0010_security_hardening.sql
-- Final security hardening: explicit REVOKE/GRANT on all functions
-- This file runs AFTER all API functions are defined to ensure proper security

-- =============================================================================
-- SECURITY HARDENING PHILOSOPHY
-- =============================================================================
-- PostgreSQL by default grants EXECUTE on functions to PUBLIC.
-- For a "thick database" architecture with role-based access control,
-- we need to:
-- 1. REVOKE EXECUTE from PUBLIC on all security-sensitive functions
-- 2. Explicitly GRANT EXECUTE only to the roles that need each function
--
-- This prevents unauthorized access even if someone bypasses the application.
-- =============================================================================

-- 1. Revoke all default PUBLIC permissions on API functions
DO $$
DECLARE
    schema_name text;
BEGIN
    FOREACH schema_name IN ARRAY ARRAY[
        'auth', 'guest_api', 'passenger_api', 'driver_api', 'dispatcher_api',
        'controller_api', 'manager_api', 'municipality_api', 'accountant_api'
    ]
    LOOP
        EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA %I FROM PUBLIC', schema_name);
    END LOOP;
END $$;

-- 2. AUTH SCHEMA - Registration
REVOKE ALL ON FUNCTION auth.register_passenger(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth.register_passenger(text, text, text, text, text) TO ct_guest_role;

-- 3. GUEST_API - Public data access (guests and all authenticated users)
-- Read functions - available to guests and above
GRANT EXECUTE ON FUNCTION guest_api.find_nearby_stops(numeric, numeric, numeric, integer)
    TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role,
       ct_municipality_role, ct_controller_role, ct_manager_role;

GRANT EXECUTE ON FUNCTION guest_api.search_stops_by_name(text, integer)
    TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role,
       ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role;

GRANT EXECUTE ON FUNCTION guest_api.plan_route(numeric, numeric, numeric, numeric, numeric, integer, integer)
    TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role,
       ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role;

GRANT EXECUTE ON FUNCTION guest_api.plan_route_pgrouting(bigint[], bigint[], integer, integer)
    TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role,
       ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role;

-- Complaint submission - guests and passengers
GRANT EXECUTE ON FUNCTION guest_api.submit_complaint(text, text, text, text, text, text)
    TO ct_guest_role, ct_passenger_role;

-- 4. PASSENGER_API - Authenticated passenger functions
GRANT EXECUTE ON FUNCTION passenger_api.submit_complaint(text, text, text, text, text) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.submit_fine_appeal(bigint, text) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.buy_ticket(bigint, bigint, numeric) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.top_up_card(text, numeric) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.find_stops_nearby(numeric, numeric, integer) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.find_routes_between(numeric, numeric, numeric, numeric, integer) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.pay_fine(bigint, bigint) TO ct_passenger_role;
GRANT EXECUTE ON FUNCTION passenger_api.log_my_gps(numeric, numeric, timestamp) TO ct_passenger_role;

-- 5. DRIVER_API - Driver operational functions
GRANT EXECUTE ON FUNCTION driver_api.cleanup_stale_trips(bigint) TO ct_driver_role;
GRANT EXECUTE ON FUNCTION driver_api.start_trip(text, timestamp, text) TO ct_driver_role;
GRANT EXECUTE ON FUNCTION driver_api.finish_trip(timestamp) TO ct_driver_role;
GRANT EXECUTE ON FUNCTION driver_api.update_passengers(bigint, integer) TO ct_driver_role;
GRANT EXECUTE ON FUNCTION driver_api.log_vehicle_gps(numeric, numeric, timestamp) TO ct_driver_role;

-- 6. DISPATCHER_API - Schedule and assignment management
GRANT EXECUTE ON FUNCTION dispatcher_api.create_schedule(
    bigint, bigint, time, time, integer,
    boolean, boolean, boolean, boolean, boolean, boolean, boolean,
    date, date
) TO ct_dispatcher_role;

GRANT EXECUTE ON FUNCTION dispatcher_api.update_schedule(
    bigint, bigint, bigint, time, time, integer,
    boolean, boolean, boolean, boolean, boolean, boolean, boolean,
    date, date
) TO ct_dispatcher_role;

GRANT EXECUTE ON FUNCTION dispatcher_api.delete_schedule(bigint) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.assign_driver_v2(bigint, text) TO ct_dispatcher_role;
GRANT EXECUTE ON FUNCTION dispatcher_api.calculate_delay(bigint) TO ct_dispatcher_role;

-- 7. CONTROLLER_API - Fine issuance and validation
GRANT EXECUTE ON FUNCTION controller_api.issue_fine(text, numeric, text, text, timestamp, bigint) TO ct_controller_role;
GRANT EXECUTE ON FUNCTION controller_api.get_active_trips(text, timestamp) TO ct_controller_role;

-- 8. MANAGER_API - Staff and fleet management
GRANT EXECUTE ON FUNCTION manager_api.hire_driver(text, text, text, text, text, text, jsonb, jsonb) TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.add_vehicle(text, bigint, text) TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.add_vehicle_v2(text, bigint, bigint, text) TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.create_staff_user(text, text, text, text, text, text) TO ct_manager_role;
GRANT EXECUTE ON FUNCTION manager_api.remove_staff_user(text) TO ct_manager_role;

-- 9. MUNICIPALITY_API - Route and analytics management
GRANT EXECUTE ON FUNCTION municipality_api.create_stop(text, numeric, numeric) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.update_stop(bigint, text, numeric, numeric) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.create_route_full(text, integer, text, jsonb, jsonb) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.recalculate_route_stop_distances(bigint) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.get_passenger_flow(date, date, text, text) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.get_complaints(date, date, text, text, text) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.set_route_active(bigint, boolean) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.update_complaint_status(bigint, text) TO ct_municipality_role;

-- 10. ACCOUNTANT_API - Financial management
GRANT EXECUTE ON FUNCTION accountant_api.upsert_budget(date, numeric, numeric, text) TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.add_expense(text, numeric, text, text, timestamp) TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.pay_salary(bigint, numeric, integer, numeric) TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.get_financial_report(date, date) TO ct_accountant_role;
GRANT EXECUTE ON FUNCTION accountant_api.calculate_driver_salary(bigint, date) TO ct_accountant_role;

-- =============================================================================
-- VIEWS SECURITY
-- =============================================================================
-- Views inherit permissions from the tables they reference, but we ensure
-- explicit grants for clarity and security audit purposes.

-- Guest API views (public read access)
GRANT SELECT ON ALL TABLES IN SCHEMA guest_api
    TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role,
       ct_municipality_role, ct_controller_role, ct_manager_role;

-- Passenger API views
GRANT SELECT ON ALL TABLES IN SCHEMA passenger_api TO ct_passenger_role;

-- Driver API views
GRANT SELECT ON ALL TABLES IN SCHEMA driver_api TO ct_driver_role;

-- Dispatcher API views
GRANT SELECT ON ALL TABLES IN SCHEMA dispatcher_api TO ct_dispatcher_role;

-- Controller API views
GRANT SELECT ON ALL TABLES IN SCHEMA controller_api TO ct_controller_role;

-- Manager API views
GRANT SELECT ON ALL TABLES IN SCHEMA manager_api TO ct_manager_role;

-- Municipality API views
GRANT SELECT ON ALL TABLES IN SCHEMA municipality_api TO ct_municipality_role;

-- Accountant API views
GRANT SELECT ON ALL TABLES IN SCHEMA accountant_api TO ct_accountant_role;

-- =============================================================================
-- FINAL VERIFICATION (for debugging, can be removed in production)
-- =============================================================================
-- This creates a helper view to audit function permissions
CREATE OR REPLACE VIEW public.v_function_permissions AS
SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    ARRAY(
        SELECT rolname FROM pg_roles r
        WHERE has_function_privilege(r.oid, p.oid, 'EXECUTE')
        AND r.rolname NOT IN ('postgres', 'ct_migrator')
        AND NOT r.rolsuper
    ) AS granted_to
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN (
    'auth', 'guest_api', 'passenger_api', 'driver_api', 'dispatcher_api',
    'controller_api', 'manager_api', 'municipality_api', 'accountant_api'
)
ORDER BY n.nspname, p.proname;

-- Only migrator can see this audit view
REVOKE ALL ON public.v_function_permissions FROM PUBLIC;
GRANT SELECT ON public.v_function_permissions TO ct_migrator;
