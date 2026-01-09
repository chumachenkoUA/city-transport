# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

City Transport is an urban transport management system with role-based access control. The architecture follows a "thick database" pattern where business roles access data through PostgreSQL views and SECURITY DEFINER functions rather than direct table access.

## Development Commands

### Infrastructure
```bash
docker compose up -d                  # Start PostgreSQL + Redis
docker compose down                   # Stop services
```

### Backend (from /backend)
```bash
pnpm run start:dev                    # Development with watch mode
pnpm run build                        # Build for production
pnpm run lint                         # ESLint with auto-fix
pnpm run format                       # Prettier formatting
pnpm run test                         # Run unit tests
pnpm run test:watch                   # Unit tests in watch mode
pnpm run test:e2e                     # Run e2e tests
pnpm run test:docker                  # Run e2e tests in isolated Docker environment
pnpm run drizzle:generate             # Generate new migration
pnpm run drizzle:migrate              # Apply migrations
pnpm run seed                         # Seed database
```

### Frontend (from /frontend)
```bash
pnpm run dev                          # Vite dev server
pnpm run build                        # TypeScript check + Vite build
pnpm run lint                         # ESLint
```

### Running a Single Test
```bash
# Backend unit test
pnpm run test -- --testPathPattern="filename"

# Backend e2e test
pnpm run test:e2e -- --testPathPattern="guest"
```

## Architecture

### Database Security Model
- 9 PostgreSQL group roles: `ct_guest_role`, `ct_passenger_role`, `ct_controller_role`, `ct_driver_role`, `ct_dispatcher_role`, `ct_manager_role`, `ct_municipality_role`, `ct_accountant_role`, `ct_admin_role`
- Each role has a corresponding `*_api` schema (e.g., `driver_api`, `controller_api`) containing views and functions
- Business roles have NO direct access to `public.*` tables
- All data access goes through views (for reads) and SECURITY DEFINER functions (for mutations)
- Backend connects to PostgreSQL using the actual user's DB login (visible in pgAdmin sessions)

### Session Management
- JWT token issued at login
- Redis stores session data (login + password for DB connection)
- DbService creates connection pools per user login dynamically
- Real PostgreSQL user shown in pgAdmin Dashboard → Sessions

### Backend Structure
- `/backend/src/roles/` - Role-specific modules (ct-admin, ct-driver, ct-controller, etc.)
- `/backend/src/db/schema/` - Drizzle ORM schema definitions
- `/backend/drizzle/` - Generated SQL migrations
- `/db/bootstrap.sql` - One-time setup (roles, schemas, extensions)

### Frontend Structure
- React 19 + Vite 7 + TypeScript
- TanStack Router for routing, TanStack Query for data fetching
- Zustand for state management (auth store persisted to localStorage)
- MapLibre GL for geospatial visualization
- Role-specific pages in `/frontend/src/pages/`

## Key Technical Details

- **Database**: PostgreSQL 16 + PostGIS 3.4 on port 5455
- **Redis**: Port 6379, used for session storage
- **Migrations**: Use `DATABASE_URL_MIGRATOR` env var for migration user (non-superuser)
- **Views**: Must use `security_barrier = true` when filtering by `session_user`
- **Functions**: Must set `search_path` and validate inputs
