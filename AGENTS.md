# Repository Guidelines

## Project Structure & Module Organization
- `backend/` contains the NestJS API. Key areas: `backend/src/modules` for feature modules, `backend/src/roles` for role-specific access, `backend/src/db/schema` for Drizzle schemas, and `backend/drizzle` for migrations.
- `backend/test/` holds Jest e2e specs; unit tests live alongside sources as `*.spec.ts`.
- `backend/static/` stores GTFS data used by the seed script.
- `frontend/` hosts the Vite + React app. Core code is in `frontend/src` with `routes/`, `components/`, `assets/`, and `lib/`.
- `db/bootstrap.sql` defines database roles and schemas. Root `docker-compose.yml` starts Postgres + Redis.

## Build, Test, and Development Commands
Run commands from the package directory.
```bash
# Backend
pnpm run start:dev        # API dev server with watch
pnpm run build            # Compile NestJS
pnpm run lint             # ESLint (auto-fix)
pnpm run format           # Prettier
pnpm run test             # Jest unit tests
pnpm run test:e2e          # Jest e2e tests
pnpm run test:docker       # e2e tests in Docker
pnpm run drizzle:migrate   # Apply migrations
pnpm run seed              # Seed database

# Frontend
pnpm run dev               # Vite dev server
pnpm run build             # TypeScript + Vite build
pnpm run lint              # ESLint
```

## Coding Style & Naming Conventions
- TypeScript throughout; use 2-space indentation as in existing files.
- Backend enforces ESLint + Prettier; frontend uses ESLint only.
- Tests: `*.spec.ts` for unit tests, `*.e2e-spec.ts` for e2e tests (see `backend/test`).

## Testing Guidelines
- Jest is the primary framework. Keep unit tests close to modules and e2e tests in `backend/test`.
- Use `pnpm run test:cov` for coverage reports; no explicit threshold is enforced.
- For DB-dependent e2e tests, prefer `pnpm run test:docker` to isolate services.

## Commit & Pull Request Guidelines
- Commit messages generally follow Conventional Commits: `feat:`, `fix:`, `test:`, `chore:`, `db:`, with optional scopes (e.g., `feat(frontend): ...`).
- PRs should include a concise summary, test evidence (commands or CI results), and UI screenshots when frontend changes are involved. Link related issues when applicable.

## Security & Configuration Notes
- Local config uses `.env` with `DATABASE_URL` and `DATABASE_URL_MIGRATOR`. Do not commit secrets.
- The system uses role-based DB access via views and SECURITY DEFINER functions. Update `db/bootstrap.sql` and migrations together when changing permissions or schema.
