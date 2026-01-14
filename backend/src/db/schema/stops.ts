import {
  bigserial,
  numeric,
  pgTable,
  unique,
  varchar,
} from 'drizzle-orm/pg-core';

export const stops = pgTable(
  'stops',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
    lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  },
  (table) => ({
    stopsNameLonLatUnique: unique('stops_name_lon_lat_unique').on(
      table.name,
      table.lon,
      table.lat,
    ),
  }),
);
