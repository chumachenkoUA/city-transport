import { sql } from 'drizzle-orm';
import {
  pgTable,
  bigserial,
  varchar,
  integer,
  bigint,
  check,
} from 'drizzle-orm/pg-core';
import { transportTypes } from './transport-types';

export const vehicleModels = pgTable(
  'vehicle_models',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    typeId: bigint('type_id', { mode: 'number' })
      .notNull()
      .references(() => transportTypes.id),
    capacity: integer('capacity').notNull(),
  },
  () => ({
    vehicleModelsCapacityCheck: check(
      'vehicle_models_capacity_check',
      sql.raw(`"capacity" > 0`),
    ),
  }),
);
