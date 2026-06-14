# qauto-cafe

Multi-branch café POS and back-office platform — NestJS API, Next.js web, Supabase Postgres, Redis.

## Stack

- **API** — NestJS, Prisma, BullMQ, Socket.IO (`apps/api`)
- **Web** — Next.js 15 (`apps/web`)
- **Database** — PostgreSQL (Supabase session pooler)
- **Cache / queues** — Redis (Upstash recommended in production)

## Local development

```bash
npm ci
docker compose up -d          # Postgres + Redis (optional if using Supabase)
cp .env.example .env          # configure DATABASE_URL, REDIS_URL, JWT secrets
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev                     # API :3001 + Web :3000
```

Default login: `admin@qauto.com` / `admin123` (PIN `1234`).

## Production deploy

| Service | Host | Config |
|---------|------|--------|
| Web | [Vercel](https://vercel.com) (recommended) | Root dir `apps/web`, see `apps/web/vercel.json` |
| Web (alt) | Railway | Config file `apps/web/railway.toml` — **not** root `railway.toml` |
| API | [Railway](https://railway.app) | Config file `apps/api/railway.toml` |
| Postgres | Supabase | `deploy/railway.api.env.example` |
| Redis | Upstash | same |

**Railway monorepo:** each service must set its own **Config file path** in Settings. There is no root `railway.toml` — using the wrong path builds the wrong Dockerfile.

See `deploy/vercel.env.example` and `deploy/railway.api.env.example` for environment variables.

## Tests

```bash
npm run test --workspace=@qauto/api
cd apps/web && npx playwright test
```

## License

Private — QAuto Café
