import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  numeric,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core';
import { transportCards } from './transport-cards';

export const cardTopUps = pgTable(
  'card_top_ups',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    cardId: bigint('card_id', { mode: 'number' })
      .notNull()
      .references(() => transportCards.id),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    toppedUpAt: timestamp('topped_up_at').notNull().defaultNow(),
  },
  () => ({
    cardTopUpsAmountCheck: check(
      'card_top_ups_amount_check',
      sql.raw('"amount" > 0'),
    ),
  }),
);
