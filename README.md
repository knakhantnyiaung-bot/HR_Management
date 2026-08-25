# HR & Payroll Management Platform

[![CI](https://github.com/knakhantnyiaung-bot/HR_Management/actions/workflows/ci.yml/badge.svg)](https://github.com/knakhantnyiaung-bot/HR_Management/actions/workflows/ci.yml)

Sprint 1 MVP. See `document/HR_Payroll_MVP_Sprint1_HLD.pdf` for the full High-Level Design.

## Stack

- **Backend**: Node.js + Express + TypeScript, Prisma ORM, PostgreSQL
- **Frontend**: React + TypeScript + Tailwind CSS (Vite), TanStack Query, React Hook Form + Zod
- **Architecture**: Modular monolith, REST API, organization-scoped multi-tenant data

## Getting started

```bash
# 1. Start PostgreSQL
docker compose up -d

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

Backend runs on `http://localhost:4000`, frontend on `http://localhost:5173`.

## Project structure

```
backend/    Express API — modular monolith (see backend/src/modules)
frontend/   React SPA (see frontend/src/features)
document/   HLD and design docs
```

## Module boundaries

Each backend module (`auth`, `organizations`, `departments`, `positions`, `employees`,
`attendance`, `leave`, `overtime`, `salary`, `payroll`, `payslips`, `dashboard`, `audit`)
follows: `controller → service → repository`. Business rules live in services; controllers
only handle HTTP; repositories only handle persistence.
