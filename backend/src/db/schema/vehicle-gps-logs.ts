import {
  bigint,
  bigserial,
  numeric,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core';
import { vehicles } from './vehicles';

export const vehicleGpsLogs = pgTable('vehicle_gps_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  vehicleId: bigint('vehicle_id', { mode: 'number' })
    .notNull()
    .references(() => vehicles.id, { onDelete: 'cascade' }),
  lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});
