-- 0035_fix_guest_schedule_permissions.sql

GRANT SELECT ON guest_api.v_schedules TO ct_driver_role, ct_passenger_role, ct_guest_role;
