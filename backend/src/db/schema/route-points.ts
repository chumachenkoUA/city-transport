import { bigint, bigserial, foreignKey, numeric, pgTable, unique } from 'drizzle-orm/pg-core';
import { routes } from './routes';

export const routePoints = pgTable(
  'route_points',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    routeId: bigint('route_id', { mode: 'number' })
      .notNull()
      .references(() => routes.id, { onDelete: 'cascade' }),
    lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
    lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
    prevRoutePointId: bigint('prev_route_point_id', {
      mode: 'number',
    }).unique(),
    nextRoutePointId: bigint('next_route_point_id', {
      mode: 'number',
    }).unique(),
  },
  (table) => ({
    routePointsRouteLonLatUnique: unique(
      'route_points_route_lon_lat_unique',
    ).on(table.routeId, table.lon, table.lat),
    routePointsPrevPointFk: foreignKey({
      columns: [table.prevRoutePointId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
    routePointsNextPointFk: foreignKey({
      columns: [table.nextRoutePointId],
      foreignColumns: [table.id],
    }).onDelete('set null'),
  }),
);
