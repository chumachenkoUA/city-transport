import { pgTable, bigserial, varchar, integer, bigint } from 'drizzle-orm/pg-core';
import { transportTypes } from './transport-types';

export const vehicleModels = pgTable('vehicle_models', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  typeId: bigint('type_id', { mode: 'number' })
    .notNull()
    .references(() => transportTypes.id),
  capacity: integer('capacity').notNull(),
});
