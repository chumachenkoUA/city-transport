import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

const migratorUrl =
  process.env.DATABASE_URL_MIGRATOR ?? process.env.DATABASE_URL;

if (!migratorUrl) {
  throw new Error('DATABASE_URL or DATABASE_URL_MIGRATOR is not set');
}

export default defineConfig({
  schema: './src/db/schema/**/*.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: migratorUrl,
  },
});
