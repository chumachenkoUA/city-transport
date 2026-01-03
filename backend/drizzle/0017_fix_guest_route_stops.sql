-- Fix guest_api.v_route_stops to include stop coordinates

DROP VIEW IF EXISTS guest_api.v_route_stops;

CREATE OR REPLACE VIEW guest_api.v_route_stops AS
SELECT rs.id,
       rs.route_id,
       rs.stop_id,
       s.name AS stop_name,
       s.lon AS lon,
       s.lat AS lat,
       rs.prev_route_stop_id,
       rs.next_route_stop_id,
       rs.distance_to_next_km
FROM public.route_stops rs
JOIN public.stops s ON s.id = rs.stop_id;
