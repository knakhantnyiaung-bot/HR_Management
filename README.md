# HR & Payroll Management Platform

[![CI](https://github.com/knakhantnyiaung-bot/HR_Management/actions/workflows/ci.yml/badge.svg)](https://github.com/knakhantnyiaung-bot/HR_Management/actions/workflows/ci.yml)

Sprint 1 MVP. See `document/HR_Payroll_MVP_Sprint1_HLD.pdf` for the full High-Level Design.

## Stack

- **Backend**: Node.js + Express + TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: React + TypeScript + Tailwind CSS (Vite), TanStack Query, React Hook Form + Zod
- **Architecture**: Modular monolith, REST API, organization-scoped multi-tenant data

## Getting started

### Option A: Docker Compose (full stack)

Builds and runs Postgres, the backend API, and the frontend (served via nginx) together —
no local Node install needed.

```bash
docker compose up -d --build
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:4000` (health check at `/health`)
- Postgres: `localhost:5432`

The backend container runs `prisma migrate deploy` on startup, so migrations are applied
automatically. Set a real `JWT_SECRET` before deploying anywhere that matters — it defaults
to `change-me-in-production` in `docker-compose.yml` (override via a root-level `.env` file).

Stop everything with `docker compose down` (add `-v` to also wipe the Postgres volume).

### Option B: Local development (hot reload)

```bash
# 1. Start PostgreSQL
docker compose up -d postgres

# 2. Install dependencies (root, installs both workspaces)
npm install

# 3. Configure environment
cp backend/.env.example backend/.env

# 4. Run database migrations
npm run prisma:migrate --workspace=backend

# 5. Start backend and frontend (separate terminals)
npm run dev:backend
npm run dev:frontend
```

Backend runs on `http://localhost:4000`, frontend on `http://localhost:5183` (see
`frontend/vite.config.ts`).

## Project structure

```
backend/              Express API — modular monolith (see backend/src/modules)
backend/Dockerfile    Backend container build
frontend/             React SPA (see frontend/src/features)
frontend/Dockerfile   Frontend container build (Vite build served via nginx)
frontend/nginx.conf   Nginx config — serves the SPA, proxies /api to the backend
docker-compose.yml    Postgres + backend + frontend services
document/             HLD and design docs
```

## Module boundaries

Each backend module (`auth`, `organizations`, `departments`, `positions`, `employees`,
`attendance`, `leave`, `overtime`, `salary`, `payroll`, `payslips`, `dashboard`, `audit`)
follows: `controller → service → repository`. Business rules live in services; controllers
only handle HTTP; repositories only handle persistence.

## License

[MIT](LICENSE)
