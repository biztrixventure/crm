# BizTrixVenture CRM

Multi-tenant, role-based CRM for managing inbound call transfers between BizTrixVenture and sub-companies.

## Tech Stack

- **Frontend:** React 18 + Vite + TailwindCSS (PWA)
- **Backend:** Node.js + Express (REST API)
- **Database:** Supabase (PostgreSQL)
- **Cache/Realtime:** Redis + Socket.io
- **Deployment:** Coolify (Docker Compose)

## Project Structure

```
├── apps/
│   ├── api/          # Node.js Express API
│   ├── web/          # React + Vite frontend
│   └── worker/       # Callback scheduler microservice
├── db/
│   └── migrations/   # SQL migration files
├── docker-compose.yml
└── .env.example
```

## Roles

| Role | Description |
|------|-------------|
| Super Admin | Full access to everything |
| Read-only Admin | View-only access to all data |
| Company Admin | Manages their own company data |
| Closer | Receives transfers, fills outcomes |
| Fronter | Creates transfers, dials numbers |

## Quick Start

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Supabase account

### Development Setup

1. Clone the repository
2. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
3. Update `.env` with your Supabase credentials
4. Run database migrations in Supabase SQL editor
5. Start development servers:
   ```bash
   # API
   cd apps/api && npm install && npm run dev

   # Web
   cd apps/web && npm install && npm run dev
   ```

### Production Deployment (Coolify)

1. Create a new project in Coolify
2. Add Docker Compose source pointing to this repo
3. Set environment variables in Coolify
4. Enable "Expose to internet" for the web service
5. Run database migrations via Supabase Dashboard

## API Documentation

Base URL: `/api/v1`

All endpoints require `Authorization: Bearer <jwt>` except `/auth/*`.

### Auth
- `POST /auth/login` - Login with email/password
- `POST /auth/totp/verify` - Verify 2FA code
- `POST /auth/logout` - Invalidate session

### Companies (Super Admin)
- `GET /companies` - List all companies
- `POST /companies` - Create company
- `PATCH /companies/:id` - Update company

### Users
- `GET /users` - List users (scoped by role)
- `POST /users` - Create user
- `PATCH /users/:id` - Update user

### Transfers
- `GET /transfers` - List transfers
- `POST /transfers` - Create transfer (Fronter)
- `PATCH /transfers/:id` - Edit transfer

### Outcomes
- `POST /outcomes` - Submit outcome (Closer)
- `GET /outcomes` - List outcomes

## License

Proprietary - BizTrixVenture
