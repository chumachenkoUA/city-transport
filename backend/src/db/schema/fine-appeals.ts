import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { fines } from './fines';

export const fineAppeals = pgTable(
  'fine_appeals',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    fineId: bigint('fine_id', { mode: 'number' })
      .notNull()
      .unique()
      .references(() => fines.id, { onDelete: 'cascade' }),
    message: text('message').notNull(),
    status: text('status').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  () => ({
    fineAppealsStatusCheck: check(
      'fine_appeals_status_check',
      sql.raw(
        `"status" in ('Подано', 'Перевіряється', 'Відхилено', 'Прийнято')`,
      ),
    ),
  }),
);
