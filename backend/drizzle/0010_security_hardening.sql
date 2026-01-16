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

-- =============================================================================
-- 2. SCHEMA-LEVEL GRANTS (замість специфічних сигнатур функцій)
-- =============================================================================
-- Використовуємо schema-level grants щоб уникнути розсинхронізації сигнатур.
-- Якщо сигнатура функції зміниться - права збережуться автоматично.

-- AUTH SCHEMA - Registration (guest може реєструватися)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO ct_guest_role;

-- GUEST_API - Public data access
-- Доступ для всіх ролей (гості + авторизовані)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA guest_api
    TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role,
       ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role;

-- PASSENGER_API - Authenticated passenger functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA passenger_api TO ct_passenger_role;

-- DRIVER_API - Driver operational functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA driver_api TO ct_driver_role;

-- DISPATCHER_API - Schedule and assignment management
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA dispatcher_api TO ct_dispatcher_role;

-- CONTROLLER_API - Fine issuance and validation
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA controller_api TO ct_controller_role;

-- MANAGER_API - Staff and fleet management
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA manager_api TO ct_manager_role;

-- MUNICIPALITY_API - Route and analytics management
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA municipality_api TO ct_municipality_role;

-- ACCOUNTANT_API - Financial management
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA accountant_api TO ct_accountant_role;

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
