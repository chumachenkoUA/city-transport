CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
ALTER TABLE "stops"
  ADD COLUMN IF NOT EXISTS "geom" geography(Point, 4326)
    GENERATED ALWAYS AS (
      ST_SetSRID(ST_MakePoint("lon"::double precision, "lat"::double precision), 4326)::geography
    ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS stops_geom_gix ON stops USING gist (geom);
--> statement-breakpoint
ALTER TABLE "user_gps_logs"
  ADD COLUMN IF NOT EXISTS "geom" geography(Point, 4326)
    GENERATED ALWAYS AS (
      ST_SetSRID(ST_MakePoint("lon"::double precision, "lat"::double precision), 4326)::geography
    ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS user_gps_logs_geom_gix ON user_gps_logs USING gist (geom);
--> statement-breakpoint
ALTER TABLE "vehicle_gps_logs"
  ADD COLUMN IF NOT EXISTS "geom" geography(Point, 4326)
    GENERATED ALWAYS AS (
      ST_SetSRID(ST_MakePoint("lon"::double precision, "lat"::double precision), 4326)::geography
    ) STORED;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS vehicle_gps_logs_geom_gix ON vehicle_gps_logs USING gist (geom);
