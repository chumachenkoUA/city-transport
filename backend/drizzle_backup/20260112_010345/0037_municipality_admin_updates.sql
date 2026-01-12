-- 0037_municipality_admin_updates.sql

CREATE OR REPLACE VIEW municipality_api.v_routes AS
SELECT
    r.id,
    r.number,
    r.direction,
    r.is_active,
    r.transport_type_id,
    tt.name AS transport_type
FROM public.routes r
JOIN public.transport_types tt ON tt.id = r.transport_type_id
ORDER BY r.number, r.direction;

CREATE OR REPLACE VIEW municipality_api.v_passenger_flow_analytics AS
SELECT
    t.starts_at::date AS trip_date,
    r.number AS route_number,
    tt.name AS transport_type,
    SUM(t.passenger_count)::integer AS passenger_count
FROM public.trips t
JOIN public.routes r ON r.id = t.route_id
JOIN public.transport_types tt ON tt.id = r.transport_type_id
GROUP BY t.starts_at::date, r.number, tt.name
ORDER BY t.starts_at::date DESC;

CREATE OR REPLACE VIEW municipality_api.v_complaints_dashboard AS
SELECT
    c.id,
    c.type,
    c.message,
    c.status,
    c.created_at,
    r.number AS route_number,
    tt.name AS transport_type,
    v.fleet_number,
    c.contact_info
FROM public.complaints_suggestions c
LEFT JOIN public.routes r ON r.id = c.route_id
LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
ORDER BY c.created_at DESC;

CREATE OR REPLACE FUNCTION municipality_api.set_route_active(
    p_route_id bigint,
    p_is_active boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.routes
    SET is_active = p_is_active
    WHERE id = p_route_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Route not found';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION municipality_api.update_complaint_status(
    p_id bigint,
    p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    IF p_status NOT IN ('Подано', 'Розглядається', 'Розглянуто') THEN
        RAISE EXCEPTION 'Invalid status';
    END IF;

    UPDATE public.complaints_suggestions
    SET status = p_status
    WHERE id = p_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Complaint not found';
    END IF;
END;
$$;

GRANT SELECT ON municipality_api.v_routes TO ct_municipality_role;
GRANT SELECT ON municipality_api.v_passenger_flow_analytics TO ct_municipality_role;
GRANT SELECT ON municipality_api.v_complaints_dashboard TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.set_route_active(bigint, boolean) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.update_complaint_status(bigint, text) TO ct_municipality_role;
