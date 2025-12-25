import { bigint, bigserial, numeric, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userGpsLogs = pgTable('user_gps_logs', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  userId: bigint('user_id', { mode: 'number' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  lon: numeric('lon', { precision: 10, scale: 7 }).notNull(),
  lat: numeric('lat', { precision: 10, scale: 7 }).notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});
