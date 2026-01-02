import { sql } from 'drizzle-orm';
import { bigserial, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const drivers = pgTable('drivers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  login: text('login').notNull().unique(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  driverLicenseNumber: text('driver_license_number').notNull().unique(),
  licenseCategories: jsonb('license_categories')
    .notNull()
    .default(sql.raw(`'[]'::jsonb`)),
  passportData: jsonb('passport_data').notNull(),
});
