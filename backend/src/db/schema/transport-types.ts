import { bigserial, pgTable, varchar } from 'drizzle-orm/pg-core';

export const transportTypes = pgTable('transport_types', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
});
