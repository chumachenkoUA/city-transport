-- 0024_municipality_route_links.sql

-- Ensure next_* links are populated when creating routes.
CREATE OR REPLACE FUNCTION municipality_api.recalculate_route_stop_distances(
  p_route_id bigint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_points_count integer;
  v_stops_count integer;
BEGIN
  SELECT count(*) INTO v_points_count
  FROM public.route_points
  WHERE route_id = p_route_id;

  SELECT count(*) INTO v_stops_count
  FROM public.route_stops
  WHERE route_id = p_route_id;

  IF v_points_count < 2 OR v_stops_count < 2 THEN
    RETURN;
  END IF;

  WITH RECURSIVE ordered_points AS (
    SELECT
      rp.id,
      rp.route_id,
      rp.lon,
      rp.lat,
      rp.prev_route_point_id,
      1 AS sort_order
    FROM public.route_points rp
    WHERE rp.route_id = p_route_id
      AND rp.prev_route_point_id IS NULL
    UNION ALL
    SELECT
      next_p.id,
      next_p.route_id,
      next_p.lon,
      next_p.lat,
      next_p.prev_route_point_id,
      op.sort_order + 1
    FROM public.route_points next_p
    JOIN ordered_points op ON next_p.prev_route_point_id = op.id
  ),
  point_distances AS (
    SELECT
      id,
      route_id,
      lon,
      lat,
      sort_order,
      SUM(
        COALESCE(
          ST_DistanceSphere(
            ST_MakePoint(lon::double precision, lat::double precision),
            ST_MakePoint(
              LAG(lon) OVER (ORDER BY sort_order)::double precision,
              LAG(lat) OVER (ORDER BY sort_order)::double precision
            )
          ),
          0
        )
      ) OVER (ORDER BY sort_order) / 1000.0 AS distance_km
    FROM ordered_points
  ),
  ordered_stops AS (
    SELECT
      rs.id,
      rs.stop_id,
      rs.prev_route_stop_id,
      rs.next_route_stop_id,
      1 AS sort_order
    FROM public.route_stops rs
    WHERE rs.route_id = p_route_id
      AND rs.prev_route_stop_id IS NULL
    UNION ALL
    SELECT
      rs.id,
      rs.stop_id,
      rs.prev_route_stop_id,
      rs.next_route_stop_id,
      os.sort_order + 1
    FROM public.route_stops rs
    JOIN ordered_stops os ON rs.prev_route_stop_id = os.id
  ),
  stop_positions AS (
    SELECT
      os.id AS route_stop_id,
      os.next_route_stop_id,
      pd.sort_order AS point_order,
      pd.distance_km
    FROM ordered_stops os
    JOIN public.stops s ON s.id = os.stop_id
    JOIN LATERAL (
      SELECT sort_order, distance_km
      FROM point_distances pd
      ORDER BY ST_DistanceSphere(
        ST_MakePoint(s.lon::double precision, s.lat::double precision),
        ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
      )
      LIMIT 1
    ) pd ON true
    WHERE os.prev_route_stop_id IS NULL
    UNION ALL
    SELECT
      os.id AS route_stop_id,
      os.next_route_stop_id,
      COALESCE(pd_next.sort_order, pd_any.sort_order) AS point_order,
      COALESCE(pd_next.distance_km, pd_any.distance_km) AS distance_km
    FROM ordered_stops os
    JOIN stop_positions sp ON os.prev_route_stop_id = sp.route_stop_id
    JOIN public.stops s ON s.id = os.stop_id
    LEFT JOIN LATERAL (
      SELECT sort_order, distance_km
      FROM point_distances pd
      WHERE pd.sort_order >= sp.point_order
      ORDER BY ST_DistanceSphere(
        ST_MakePoint(s.lon::double precision, s.lat::double precision),
        ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
      )
      LIMIT 1
    ) pd_next ON true
    LEFT JOIN LATERAL (
      SELECT sort_order, distance_km
      FROM point_distances pd
      ORDER BY ST_DistanceSphere(
        ST_MakePoint(s.lon::double precision, s.lat::double precision),
        ST_MakePoint(pd.lon::double precision, pd.lat::double precision)
      )
      LIMIT 1
    ) pd_any ON true
  ),
  stop_distances AS (
    SELECT
      sp.route_stop_id,
      sp.next_route_stop_id,
      (next_sp.distance_km - sp.distance_km) AS distance_to_next_km
    FROM stop_positions sp
    LEFT JOIN stop_positions next_sp ON next_sp.route_stop_id = sp.next_route_stop_id
  )
  UPDATE public.route_stops rs
  SET distance_to_next_km = CASE
    WHEN sd.next_route_stop_id IS NULL THEN NULL
    ELSE GREATEST(sd.distance_to_next_km, 0)
  END
  FROM stop_distances sd
  WHERE rs.id = sd.route_stop_id;
END;
$$;

CREATE OR REPLACE FUNCTION municipality_api.create_route_full(
  p_number text,
  p_transport_type_id integer,
  p_direction text,
  p_stops_json jsonb,
  p_points_json jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_route_id bigint;
  v_stop record;
  v_point record;
  v_prev_stop_id bigint := NULL;
  v_current_stop_id bigint;
  v_new_stop_id bigint;
  v_prev_point_id bigint := NULL;
  v_current_point_id bigint;
BEGIN
  INSERT INTO public.routes (number, transport_type_id, direction, is_active)
  VALUES (p_number, p_transport_type_id, p_direction, true)
  RETURNING id INTO v_route_id;

  FOR v_stop IN
    SELECT * FROM jsonb_to_recordset(p_stops_json)
      AS x(stop_id bigint, name text, lon numeric, lat numeric, distance_to_next_km numeric)
  LOOP
    IF v_stop.stop_id IS NOT NULL THEN
      v_new_stop_id := v_stop.stop_id;
    ELSE
      INSERT INTO public.stops (name, lon, lat)
      VALUES (v_stop.name, v_stop.lon, v_stop.lat)
      RETURNING id INTO v_new_stop_id;
    END IF;

    INSERT INTO public.route_stops (
      route_id,
      stop_id,
      prev_route_stop_id,
      distance_to_next_km
    )
    VALUES (
      v_route_id,
      v_new_stop_id,
      v_prev_stop_id,
      v_stop.distance_to_next_km
    )
    RETURNING id INTO v_current_stop_id;

    IF v_prev_stop_id IS NOT NULL THEN
      UPDATE public.route_stops
      SET next_route_stop_id = v_current_stop_id
      WHERE id = v_prev_stop_id;
    END IF;

    v_prev_stop_id := v_current_stop_id;
  END LOOP;

  FOR v_point IN
    SELECT * FROM jsonb_to_recordset(p_points_json) AS x(lon numeric, lat numeric)
  LOOP
    INSERT INTO public.route_points (
      route_id,
      lon,
      lat,
      prev_route_point_id
    )
    VALUES (
      v_route_id,
      v_point.lon,
      v_point.lat,
      v_prev_point_id
    )
    RETURNING id INTO v_current_point_id;

    IF v_prev_point_id IS NOT NULL THEN
      UPDATE public.route_points
      SET next_route_point_id = v_current_point_id
      WHERE id = v_prev_point_id;
    END IF;

    v_prev_point_id := v_current_point_id;
  END LOOP;

  PERFORM municipality_api.recalculate_route_stop_distances(v_route_id);

  RETURN v_route_id;
END;
$$;
