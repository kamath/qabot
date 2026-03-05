<<<<<<< HEAD
This repository is now a Turborepo with a single app package: `apps/web`.
=======
# Flamecast (Internal)
>>>>>>> bc40fa2 (actual monorepo)

Internal infrastructure for [Flamecast](https://flamecast.dev) — the AI coding agent that runs as a GitHub Action.

<<<<<<< HEAD
From the repository root, use Turbo:

```bash
bun run dev

# Build and lint all packages
bun run build
bun run lint
```

Open [http://localhost:3000](http://localhost:3000) to run the app from `apps/web`.

You can start editing the page by modifying `apps/web/src/app/page.tsx`. The page auto-updates as you edit the file.
=======
The public-facing GitHub Action and API schemas live in [smithery-ai/flamecast](https://github.com/smithery-ai/flamecast).

## Architecture

```
apps/
  flamecast-backend/    Hono.js API on Cloudflare Workers (api.flamecast.dev)
  flamecast-frontend/   React SPA + Hono worker on Cloudflare Workers (flamecast.dev)

packages/
  auth/                 Shared auth middleware (JWT + API key validation)
  db/                   Drizzle ORM schemas (PostgreSQL)
  utils/                Shared utilities (logger, URLs, OpenAPI helpers)
  cli/                  `ff` CLI for dispatching workflows from the terminal
  typescript-config/    Shared tsconfig base
```

## Cloudflare type generation

`pnpm i` runs the monorepo `postinstall` build, which triggers each app's `cf-typegen` task.
>>>>>>> bc40fa2 (actual monorepo)

`cf-typegen` now prefers committed template files (`.env.example` / `.dev.vars.example`) via `wrangler types --env-file ...`. This keeps generated `worker-configuration.d.ts` stable across machines instead of drifting with local secret files.

If neither template files nor local `.env`/`.dev.vars` files are present with assignments, `cf-typegen` exits early and keeps the committed `worker-configuration.d.ts` file unchanged.

### Local backend URL

On startup, `scripts/dev-setup.mjs` automatically writes `http://localhost:6970` to:

- `packages/cli/.env` as `FLAMECAST_BASE_URL` (consumed by CLI)

To test the CLI against the local backend:

```sh
pnpm --filter @flamecast/cli dev:local -- cast list
```

## Authentication

All auth is powered by [WorkOS](https://workos.com). The backend accepts two types of Bearer tokens via the `Authorization` header, validated in `packages/auth/src/auth.ts`:

### 1. JWT access tokens (web frontend)

Short-lived (5-minute) JWTs issued by WorkOS. The backend verifies them by fetching WorkOS JWKS and checking the signature (via `jose`). The `sub` claim is the user ID.

**How the frontend obtains them:**

The frontend worker (`apps/flamecast-frontend/src/worker/routes/auth.ts`) handles the WorkOS AuthKit OAuth flow:

1. User visits `/auth/login` → redirected to WorkOS AuthKit
2. Callback at `/auth/callback` exchanges the code for a sealed session, stored as an httpOnly cookie (`wos-session`)
3. The React app calls `/auth/session` (on the frontend worker) which unseals the cookie and returns a fresh JWT access token
4. The Stainless SDK (`@flamecast/api`) sends `Authorization: Bearer <jwt>` to the backend at `api.flamecast.dev`

Token refresh: the frontend proactively re-fetches `/auth/session` every 4 minutes and retries on 401. The `/auth/session` endpoint transparently refreshes the sealed session cookie if the JWT has expired.

### 2. Organization API keys (CLI / programmatic)

Long-lived keys created via WorkOS organization API keys. The backend validates them by calling `workos.apiKeys.validateApiKey()`, then maps the organization to a user via the `user_organizations` table.

**How the CLI obtains them:**

1. CLI authenticates with WorkOS (OAuth + refresh token)
2. Calls `POST /auth/cli/exchange` with the refresh token
3. Backend exchanges the refresh token, ensures a personal organization exists, and mints a new org API key via `workos.organizations.createOrganizationApiKey()`
4. CLI stores and uses this API key for all subsequent requests

### Key files

| File | Purpose |
|------|---------|
| `packages/auth/src/auth.ts` | `authenticateBearer` — JWT verification + API key validation |
| `packages/auth/src/middleware.ts` | `authMiddleware` (Bearer), `sessionMiddleware` (cookie), `workspaceMiddleware` |
| `apps/flamecast-backend/src/routes/auth.ts` | CLI exchange, web OAuth flow, token refresh |
| `apps/flamecast-backend/src/routes/api-keys.ts` | CRUD for user-facing API keys |
| `apps/flamecast-frontend/src/worker/routes/auth.ts` | Frontend OAuth flow, `/auth/session` endpoint |
| `apps/flamecast-frontend/src/react-app/lib/auth-context.tsx` | React auth state, token refresh logic |
| `apps/flamecast-frontend/src/react-app/lib/api.ts` | API client with custom fetch (401 retry) |

## Database

```sh
pnpm --filter @flamecast/db db:generate   # generate migrations
pnpm --filter @flamecast/db db:migrate    # run migrations
pnpm --filter @flamecast/db db:studio     # open Drizzle Studio
```
