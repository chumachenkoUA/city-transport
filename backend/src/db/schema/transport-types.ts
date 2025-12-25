import { bigserial, pgTable, text } from 'drizzle-orm/pg-core';

export const transportTypes = pgTable('transport_types', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  name: text('name').notNull().unique(),
});
