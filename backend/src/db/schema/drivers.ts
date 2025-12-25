import { bigserial, jsonb, pgTable, text } from 'drizzle-orm/pg-core';

export const drivers = pgTable('drivers', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().unique(),
  fullName: text('full_name').notNull(),
  driverLicenseNumber: text('driver_license_number').notNull().unique(),
  passportData: jsonb('passport_data').notNull(),
});
