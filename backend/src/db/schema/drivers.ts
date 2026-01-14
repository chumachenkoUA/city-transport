import { sql } from 'drizzle-orm';
import { bigserial, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core';

export const drivers = pgTable('drivers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  login: varchar('login', { length: 50 }).notNull().unique(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  driverLicenseNumber: varchar('driver_license_number', { length: 20 })
    .notNull()
    .unique(),
  licenseCategories: jsonb('license_categories')
    .notNull()
    .default(sql.raw(`'[]'::jsonb`)),
  passportData: jsonb('passport_data').notNull(),
});
