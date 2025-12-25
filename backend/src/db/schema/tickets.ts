import { sql } from 'drizzle-orm';
import { bigint, bigserial, check, numeric, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { transportCards } from './transport-cards';
import { trips } from './trips';

export const tickets = pgTable(
  'tickets',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    tripId: bigint('trip_id', { mode: 'number' })
      .notNull()
      .references(() => trips.id),
    cardId: bigint('card_id', { mode: 'number' })
      .notNull()
      .references(() => transportCards.id),
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    purchasedAt: timestamp('purchased_at').notNull().defaultNow(),
  },
  () => ({
    ticketsPriceCheck: check('tickets_price_check', sql.raw('"price" >= 0')),
  }),
);
