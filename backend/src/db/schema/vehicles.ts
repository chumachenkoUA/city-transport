import { bigint, bigserial, pgTable, text } from 'drizzle-orm/pg-core';
import { routes } from './routes';
import { vehicleModels } from './vehicle-models';

export const vehicles = pgTable('vehicles', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  fleetNumber: text('fleet_number').notNull().unique(),
  vehicleModelId: bigint('vehicle_model_id', { mode: 'number' }).references(
    () => vehicleModels.id,
  ),
  routeId: bigint('route_id', { mode: 'number' })
    .notNull()
    .references(() => routes.id),
});
