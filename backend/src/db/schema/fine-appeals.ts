import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  pgTable,
  timestamp,
  varchar,
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
    message: varchar('message', { length: 2000 }).notNull(),
    status: varchar('status', { length: 50 }).notNull(),
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
