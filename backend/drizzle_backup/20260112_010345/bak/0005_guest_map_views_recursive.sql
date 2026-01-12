-- 0005_guest_map_views_recursive.sql

-- 1. View for Route Lines (Recursive CTE to traverse the Linked List)
CREATE OR REPLACE VIEW guest_api.v_route_geometries AS
WITH RECURSIVE ordered_points AS (
    -- Anchor: Find the first point of each route (where prev_route_point_id is NULL)
    SELECT
        rp.route_id,
        rp.id,
        rp.lon,
        rp.lat,
        1 AS sort_order
    FROM public.route_points rp
    WHERE rp.prev_route_point_id IS NULL

    UNION ALL

    -- Recursion: Find the point that has the previous point's ID as its prev_route_point_id
    SELECT
        next_p.route_id,
        next_p.id,
        next_p.lon,
        next_p.lat,
        op.sort_order + 1
    FROM public.route_points next_p
             JOIN ordered_points op ON next_p.prev_route_point_id = op.id
)
SELECT
    r.id AS route_id,
    r.number,
    tt.name AS transport_type,
    r.direction,
    ST_AsGeoJSON(
            ST_MakeLine(
                    ST_SetSRID(ST_MakePoint(op.lon, op.lat), 4326)
                    ORDER BY op.sort_order
            )
    )::jsonb AS geometry
FROM public.routes r
         JOIN public.transport_types tt ON tt.id = r.transport_type_id
         JOIN ordered_points op ON op.route_id = r.id
WHERE r.is_active = true
GROUP BY r.id, r.number, tt.name, r.direction;

-- 2. View for Stops as GeoJSON Points (for easy mapping)
CREATE OR REPLACE VIEW guest_api.v_stop_geometries AS
SELECT
    s.id,
    s.name,
    ST_AsGeoJSON(ST_SetSRID(ST_MakePoint(s.lon, s.lat), 4326))::jsonb AS geometry
FROM public.stops s;

-- 3. Grants
GRANT SELECT ON guest_api.v_route_geometries TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;
GRANT SELECT ON guest_api.v_stop_geometries TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_municipality_role, ct_controller_role, ct_manager_role;
