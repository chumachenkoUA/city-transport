import { sql } from 'drizzle-orm';
import { bigint, bigserial, check, numeric, pgTable, text } from 'drizzle-orm/pg-core';
import { users } from './users';

export const transportCards = pgTable(
  'transport_cards',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: bigint('user_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: 'cascade' }),
    balance: numeric('balance', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    cardNumber: text('card_number').notNull().unique(),
  },
  () => ({
    transportCardsBalanceCheck: check(
      'transport_cards_balance_check',
      sql.raw('"balance" >= 0'),
    ),
  }),
);
