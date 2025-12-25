import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  foreignKey,
  numeric,
  pgTable,
  unique,
} from 'drizzle-orm/pg-core';
import { routes } from './routes';
import { stops } from './stops';

export const routeStops = pgTable(
  'route_stops',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    stopId: bigint('stop_id', { mode: 'number' })
      .notNull()
      .references(() => stops.id),
    prevRouteStopId: bigint('prev_route_stop_id', { mode: 'number' }).unique(),
    nextRouteStopId: bigint('next_route_stop_id', { mode: 'number' }).unique(),
    distanceToNextKm: numeric('distance_to_next_km', {
      precision: 10,
      scale: 3,
    }),
  },
  (table) => ({
    routeStopsRouteStopUnique: unique('route_stops_route_stop_unique').on(
      table.routeId,
      table.stopId,
    ),
    routeStopsPrevStopFk: foreignKey({
      columns: [table.prevRouteStopId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
    routeStopsNextStopFk: foreignKey({
      columns: [table.nextRouteStopId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
    routeStopsDistanceCheck: check(
      'route_stops_distance_check',
      sql.raw('"distance_to_next_km" >= 0'),
    ),
  }),
);
