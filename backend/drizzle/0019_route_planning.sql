-- Міграція для системи планування маршрутів
-- Використовує "thick database" підхід - вся бізнес-логіка в PostgreSQL

-- ================================================
-- ФАЗА 1: Функція планування маршрутів з пересадками
-- ================================================

CREATE OR REPLACE FUNCTION guest_api.plan_route(
  p_lon_a numeric,
  p_lat_a numeric,
  p_lon_b numeric,
  p_lat_b numeric,
  p_radius_m numeric DEFAULT 500,
  p_max_wait_min integer DEFAULT 10,
  p_max_results integer DEFAULT 5
)
RETURNS TABLE (
  route_option jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_current_time time;
  v_current_minutes integer;
BEGIN
  -- Поточний час для розрахунку відправлення
  v_current_time := CURRENT_TIME;
  v_current_minutes := EXTRACT(HOUR FROM v_current_time) * 60 + EXTRACT(MINUTE FROM v_current_time);

  RETURN QUERY
  WITH
  -- 1. Найближчі зупинки до точок А і Б
  stops_a AS (
    SELECT id, name, lon, lat, distance_m
    FROM guest_api.find_nearby_stops(p_lon_a, p_lat_a, p_radius_m, 3)
  ),
  stops_b AS (
    SELECT id, name, lon, lat, distance_m
    FROM guest_api.find_nearby_stops(p_lon_b, p_lat_b, p_radius_m, 3)
  ),

  -- 2. ПРЯМІ МАРШРУТИ (без пересадок)
  direct_routes AS (
    SELECT
      sa.id AS stop_a_id,
      sb.id AS stop_b_id,
      r.id AS route_id,
      r.number AS route_number,
      tt.name AS transport_type,
      r.transport_type_id,
      r.direction,
      -- Знайти індекси зупинок на маршруті
      (WITH RECURSIVE ordered AS (
        SELECT rs.id, rs.stop_id, rs.next_route_stop_id, 0 AS idx
        FROM route_stops rs
        WHERE rs.route_id = r.id AND rs.prev_route_stop_id IS NULL
        UNION ALL
        SELECT rs.id, rs.stop_id, rs.next_route_stop_id, o.idx + 1
        FROM route_stops rs
        JOIN ordered o ON rs.id = o.next_route_stop_id
      )
      SELECT idx FROM ordered WHERE stop_id = sa.id) AS idx_a,
      (WITH RECURSIVE ordered AS (
        SELECT rs.id, rs.stop_id, rs.next_route_stop_id, 0 AS idx
        FROM route_stops rs
        WHERE rs.route_id = r.id AND rs.prev_route_stop_id IS NULL
        UNION ALL
        SELECT rs.id, rs.stop_id, rs.next_route_stop_id, o.idx + 1
        FROM route_stops rs
        JOIN ordered o ON rs.id = o.next_route_stop_id
      )
      SELECT idx FROM ordered WHERE stop_id = sb.id) AS idx_b,
      -- Розрахувати відстань між зупинками
      (WITH RECURSIVE segment AS (
        SELECT rs.id, rs.distance_to_next_km, rs.next_route_stop_id, rs.stop_id
        FROM route_stops rs
        WHERE rs.route_id = r.id AND rs.stop_id = sa.id
        UNION ALL
        SELECT rs.id, rs.distance_to_next_km, rs.next_route_stop_id, rs.stop_id
        FROM route_stops rs
        JOIN segment s ON rs.id = s.next_route_stop_id
        WHERE rs.stop_id != sb.id
      )
      SELECT COALESCE(SUM(distance_to_next_km::numeric), 0) FROM segment) AS distance_km
    FROM stops_a sa
    CROSS JOIN stops_b sb
    JOIN route_stops rsa ON rsa.stop_id = sa.id
    JOIN route_stops rsb ON rsb.stop_id = sb.id AND rsb.route_id = rsa.route_id
    JOIN routes r ON r.id = rsa.route_id
    JOIN transport_types tt ON tt.id = r.transport_type_id
    WHERE r.is_active = true
  ),

  -- Додати деталі графіку для прямих маршрутів
  direct_with_schedule AS (
    SELECT
      dr.*,
      s.work_start_time,
      s.work_end_time,
      s.interval_min,
      -- Розрахувати час в дорозі (25 км/год)
      ROUND((dr.distance_km / 25.0) * 60)::integer AS travel_min,
      -- Наступний час відправлення
      (
        EXTRACT(HOUR FROM s.work_start_time)::integer * 60 +
        EXTRACT(MINUTE FROM s.work_start_time)::integer +
        (CEIL((v_current_minutes - (EXTRACT(HOUR FROM s.work_start_time)::integer * 60 + EXTRACT(MINUTE FROM s.work_start_time)::integer))::numeric / s.interval_min) * s.interval_min)
      )::integer AS next_departure_min
    FROM direct_routes dr
    LEFT JOIN schedules s ON s.route_id = dr.route_id
    WHERE dr.idx_a IS NOT NULL
      AND dr.idx_b IS NOT NULL
      AND dr.idx_a < dr.idx_b
      AND dr.distance_km > 0
  ),

  -- 3. МАРШРУТИ З 1 ПЕРЕСАДКОЮ
  -- TODO: Додати логіку пересадок (складніше, можна в наступній ітерації)
  -- transfer_routes AS (
  --   ...логіка для пошуку маршрутів з пересадками...
  -- ),

  -- 4. ОБ'ЄДНАТИ та форматувати результат
  all_routes AS (
    SELECT
      jsonb_build_object(
        'totalTimeMin', dws.travel_min,
        'totalDistanceKm', dws.distance_km,
        'transferCount', 0,
        'segments', jsonb_build_array(
          jsonb_build_object(
            'routeId', dws.route_id,
            'routeNumber', dws.route_number,
            'transportType', dws.transport_type,
            'transportTypeId', dws.transport_type_id,
            'direction', dws.direction,
            'fromStop', jsonb_build_object(
              'id', dws.stop_a_id,
              'name', (SELECT name FROM stops WHERE id = dws.stop_a_id),
              'lon', (SELECT lon FROM stops WHERE id = dws.stop_a_id),
              'lat', (SELECT lat FROM stops WHERE id = dws.stop_a_id)
            ),
            'toStop', jsonb_build_object(
              'id', dws.stop_b_id,
              'name', (SELECT name FROM stops WHERE id = dws.stop_b_id),
              'lon', (SELECT lon FROM stops WHERE id = dws.stop_b_id),
              'lat', (SELECT lat FROM stops WHERE id = dws.stop_b_id)
            ),
            'distanceKm', dws.distance_km,
            'travelTimeMin', dws.travel_min,
            'departureTime', TO_CHAR((dws.next_departure_min || ' minutes')::interval, 'HH24:MI'),
            'arrivalTime', TO_CHAR((dws.next_departure_min + dws.travel_min || ' minutes')::interval, 'HH24:MI')
          )
        )
      ) AS route_option,
      dws.travel_min AS sort_key
    FROM direct_with_schedule dws
    WHERE dws.next_departure_min IS NOT NULL
      AND dws.interval_min IS NOT NULL
  )

  SELECT route_option
  FROM all_routes
  ORDER BY sort_key
  LIMIT p_max_results;
END;
$$;

-- Надати доступ усім ролям
GRANT EXECUTE ON FUNCTION guest_api.plan_route(numeric, numeric, numeric, numeric, numeric, integer, integer)
TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role, ct_admin_role;

-- ================================================
-- ФАЗА 2: Функція пошуку зупинок за назвою
-- ================================================

CREATE OR REPLACE FUNCTION guest_api.search_stops_by_name(
  p_query text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  name text,
  lon numeric,
  lat numeric
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT s.id, s.name, s.lon, s.lat
  FROM stops s
  WHERE s.name ILIKE '%' || p_query || '%'
  ORDER BY
    CASE
      WHEN s.name ILIKE p_query || '%' THEN 1  -- Починається з запиту
      ELSE 2
    END,
    s.name
  LIMIT p_limit;
$$;

-- Надати доступ усім ролям
GRANT EXECUTE ON FUNCTION guest_api.search_stops_by_name(text, integer)
TO ct_guest_role, ct_passenger_role, ct_driver_role, ct_dispatcher_role, ct_controller_role, ct_municipality_role, ct_manager_role, ct_accountant_role, ct_admin_role;

-- ================================================
-- Індекси для оптимізації
-- ================================================

-- Триграм індекс для швидкого пошуку зупинок за назвою
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_stops_name_trgm ON stops USING gin (name gin_trgm_ops);

-- Коментарі для документації
COMMENT ON FUNCTION guest_api.plan_route IS
'Планування маршрутів між двома точками з підтримкою пересадок.
Використовує thick database підхід - вся логіка в PostgreSQL.
Параметри:
- p_lon_a, p_lat_a: координати точки відправлення
- p_lon_b, p_lat_b: координати точки призначення
- p_radius_m: радіус пошуку зупинок навколо точок (default 500m)
- p_max_wait_min: максимальний час очікування на пересадці (default 10 хв)
- p_max_results: максимальна кількість результатів (default 5)
Повертає: JSONB з деталями маршруту';

COMMENT ON FUNCTION guest_api.search_stops_by_name IS
'Пошук зупинок за назвою з використанням ILIKE та триграм індексу.
Результати сортуються: спочатку ті що починаються з запиту, потім решта';
