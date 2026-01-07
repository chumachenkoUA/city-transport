import { pgTable, serial, varchar, integer } from 'drizzle-orm/pg-core';
import { transportTypes } from './transport-types';

export const vehicleModels = pgTable('vehicle_models', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  typeId: integer('type_id')
    .notNull()
    .references(() => transportTypes.id),
  capacity: integer('capacity').notNull(),
});
