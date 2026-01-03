-- Grant access to guest_api.v_route_stops for role-based API usage

DO $$
BEGIN
  IF to_regrole('ct_driver_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_stops TO ct_driver_role';
  END IF;
  IF to_regrole('ct_guest_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_stops TO ct_guest_role';
  END IF;
  IF to_regrole('ct_passenger_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_stops TO ct_passenger_role';
  END IF;
  IF to_regrole('ct_dispatcher_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_stops TO ct_dispatcher_role';
  END IF;
  IF to_regrole('ct_municipality_role') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON guest_api.v_route_stops TO ct_municipality_role';
  END IF;
END $$;
