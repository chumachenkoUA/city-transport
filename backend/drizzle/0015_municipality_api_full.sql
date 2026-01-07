-- 0015_municipality_api_full.sql

-- 1. АНАЛІТИКА ПАСАЖИРОПОТОКУ (Вимога 3)

CREATE OR REPLACE FUNCTION municipality_api.get_passenger_flow(
    p_start_date date,
    p_end_date date,
    p_route_number text DEFAULT NULL,
    p_transport_type text DEFAULT NULL
)
    RETURNS TABLE (
                      trip_date date,
                      route_number text,
                      transport_type text,
                      fleet_number text,
                      passenger_count integer
                  )
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
        SELECT
            t.starts_at::date as trip_date,
            r.number as route_number,
            tt.name as transport_type,
            v.fleet_number,
            t.passenger_count
        FROM public.trips t
                 JOIN public.routes r ON r.id = t.route_id
                 JOIN public.transport_types tt ON tt.id = r.transport_type_id
                 JOIN public.vehicles v ON v.id = t.vehicle_id
        WHERE t.starts_at >= p_start_date AND t.starts_at < p_end_date + 1
          AND (p_route_number IS NULL OR r.number = p_route_number)
          AND (p_transport_type IS NULL OR tt.name = p_transport_type)
        ORDER BY t.starts_at DESC;
END;
$$;

-- 2. СКАРГИ ТА ПРОПОЗИЦІЇ (Вимога 4)

CREATE OR REPLACE FUNCTION municipality_api.get_complaints(
    p_start_date date DEFAULT NULL,
    p_end_date date DEFAULT NULL,
    p_route_number text DEFAULT NULL,
    p_transport_type text DEFAULT NULL,
    p_fleet_number text DEFAULT NULL
)
    RETURNS TABLE (
                      id bigint,
                      type text,
                      message text,
                      status text,
                      created_at timestamp,
                      route_number text,
                      transport_type text,
                      fleet_number text,
                      contact_info text
                  )
    LANGUAGE plpgsql
    STABLE
    SECURITY DEFINER
    SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
        SELECT
            c.id,
            c.type,
            c.message,
            c.status,
            c.created_at,
            r.number as route_number,
            tt.name as transport_type,
            v.fleet_number,
            c.contact_info
        FROM public.complaints_suggestions c
                 LEFT JOIN public.routes r ON r.id = c.route_id
                 LEFT JOIN public.transport_types tt ON tt.id = r.transport_type_id
                 LEFT JOIN public.vehicles v ON v.id = c.vehicle_id
        WHERE (p_start_date IS NULL OR c.created_at >= p_start_date)
          AND (p_end_date IS NULL OR c.created_at < p_end_date + 1)
          AND (p_route_number IS NULL OR r.number = p_route_number)
          AND (p_transport_type IS NULL OR tt.name = p_transport_type)
          AND (p_fleet_number IS NULL OR v.fleet_number = p_fleet_number)
        ORDER BY c.created_at DESC;
END;
$$;

-- 3. УПРАВЛІННЯ ЗУПИНКАМИ (Вимога 2) - View для читання списку
CREATE OR REPLACE VIEW municipality_api.v_stops AS
SELECT id, name, lon, lat FROM public.stops ORDER BY name;

-- 4. GRANTS

GRANT EXECUTE ON FUNCTION municipality_api.get_passenger_flow(date, date, text, text) TO ct_municipality_role;
GRANT EXECUTE ON FUNCTION municipality_api.get_complaints(date, date, text, text, text) TO ct_municipality_role;
GRANT SELECT ON municipality_api.v_stops TO ct_municipality_role;

-- create_stop, update_stop, create_route_full вже мають гранти з 0002
