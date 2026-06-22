# QAuto Café — Supabase + Vercel production stack

Multi-branch café POS and back-office platform.

## Stack

- **Web + API** — Next.js 15 on [Vercel](https://vercel.com) (API colocated as serverless NestJS)
- **Database** — PostgreSQL on [Supabase](https://supabase.com)
- **File storage** — Supabase Storage (`menu-images` bucket)
- **Local dev** — Docker Compose or `npm run dev` (API :3001 + Web :3000)

## Local development

```bash
npm ci
docker compose up -d          # optional Postgres; or use Supabase DATABASE_URL
cp .env.example .env          # DATABASE_URL, JWT secrets, SUPABASE_* for storage
npm run db:generate
npx prisma migrate deploy
npm run db:seed
npm run dev                   # API :3001 + Web :3000
```

Default login: `admin@qauto.com` / `admin123` (PIN `1234`).

## Production deploy (Supabase + Vercel)

| Layer | Host |
|-------|------|
| Web + API | Vercel (`apps/web`, see `apps/web/vercel.json`) |
| Postgres | Supabase |
| Menu images | Supabase Storage |

### One-time Supabase setup

1. Create a Supabase project.
2. Run Prisma migrations: `npx prisma migrate deploy`
3. Run storage bucket SQL: `supabase/migrations/20250623100000_menu_images_bucket.sql` (SQL editor or Supabase CLI)
4. Copy env vars from `deploy/supabase.env.example` and `deploy/vercel.env.example`

### Vercel setup

1. Root directory: **`apps/web`**
2. Enable **Include source files outside of the Root Directory**
3. Set all variables from `deploy/vercel.env.example` (includes API + Supabase secrets)
4. Run migrations before/after deploy: `npx prisma migrate deploy` (CI or manual)

**No Railway or separate API host.** `/api/v1/*` is served by the colocated NestJS app on Vercel.

### Local Docker (optional)

```bash
docker compose up --build
```

Uses local Postgres + API + Web. For Supabase Storage in Docker, set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

## Tests

```bash
npm run test --workspace=@qauto/api
cd apps/web && npx playwright test
```

## License

Private — QAuto Café
