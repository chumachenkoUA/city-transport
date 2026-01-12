-- Fix path_id type to match function return signature
CREATE OR REPLACE FUNCTION guest_api.plan_route_pgrouting(
  p_start_stop_ids bigint[],
  p_end_stop_ids bigint[],
  p_transfer_penalty integer DEFAULT 8,
  p_max_paths integer DEFAULT 5
)
RETURNS TABLE (
  seq integer,
  node bigint,
  edge bigint,
  cost double precision,
  agg_cost double precision,
  route_id bigint,
  stop_id bigint,
  path_id integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_edge_count integer;
  v_edges_sql text;
  v_start_nodes bigint[];
  v_end_nodes bigint[];
BEGIN
  SELECT array_agg(rs.id) INTO v_start_nodes
  FROM public.route_stops rs
  WHERE rs.stop_id = ANY(p_start_stop_ids);

  SELECT array_agg(rs.id) INTO v_end_nodes
  FROM public.route_stops rs
  WHERE rs.stop_id = ANY(p_end_stop_ids);

  IF v_start_nodes IS NULL OR v_end_nodes IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*) INTO v_edge_count
  FROM public.route_stops rs
  WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL;

  v_edges_sql := format($f$
    SELECT id, source, target, cost, reverse_cost FROM (
      SELECT
        row_number() OVER () AS id,
        rs.id AS source,
        rs.next_route_stop_id AS target,
        (COALESCE(rs.distance_to_next_km, 0) / 25.0) * 60.0 AS cost,
        -1::double precision AS reverse_cost
      FROM public.route_stops rs
      WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL
      UNION ALL
      SELECT
        row_number() OVER () + %s AS id,
        rs_from.id AS source,
        rs_to.id AS target,
        %s::double precision AS cost,
        -1::double precision AS reverse_cost
      FROM public.route_stops rs_from
      JOIN public.route_stops rs_to
        ON rs_from.stop_id = rs_to.stop_id
       AND rs_from.id <> rs_to.id
    ) edges
  $f$, v_edge_count, p_transfer_penalty);

  RETURN QUERY
  WITH edges AS (
    SELECT
      row_number() OVER () AS id,
      rs.id AS source,
      rs.next_route_stop_id AS target,
      (COALESCE(rs.distance_to_next_km, 0) / 25.0) * 60.0 AS cost,
      -1::double precision AS reverse_cost,
      rs.route_id AS route_id
    FROM public.route_stops rs
    WHERE rs.route_id IS NOT NULL AND rs.next_route_stop_id IS NOT NULL
    UNION ALL
    SELECT
      row_number() OVER () + v_edge_count AS id,
      rs_from.id AS source,
      rs_to.id AS target,
      p_transfer_penalty::double precision AS cost,
      -1::double precision AS reverse_cost,
      NULL::bigint AS route_id
    FROM public.route_stops rs_from
    JOIN public.route_stops rs_to
      ON rs_from.stop_id = rs_to.stop_id
     AND rs_from.id <> rs_to.id
  ),
  path AS (
    SELECT * FROM pgr_dijkstra(
      v_edges_sql,
      v_start_nodes,
      v_end_nodes,
      directed := true
    )
  ),
  best AS (
    SELECT p.start_vid, p.end_vid, MIN(p.agg_cost) AS total_cost
    FROM path p
    GROUP BY p.start_vid, p.end_vid
  ),
  ranked AS (
    SELECT
      b.start_vid,
      b.end_vid,
      b.total_cost,
      row_number() OVER (ORDER BY b.total_cost) AS path_id
    FROM best b
    ORDER BY b.total_cost
    LIMIT p_max_paths
  )
  SELECT
    p.seq,
    p.node,
    p.edge,
    p.cost,
    p.agg_cost,
    e.route_id,
    rs.stop_id,
    r.path_id::integer
  FROM path p
  JOIN ranked r
    ON r.start_vid = p.start_vid
   AND r.end_vid = p.end_vid
  LEFT JOIN edges e ON e.id = p.edge
  LEFT JOIN public.route_stops rs ON rs.id = p.node
  ORDER BY r.path_id, p.seq;
END;
$$;
