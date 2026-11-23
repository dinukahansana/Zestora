# Zestora

**Freshness in Every Sip.**

Zestora is a configurable ordering and business management platform for juice bars and other beverage shops. It has an English/Sinhala storefront with a demo catalogue. With a database connected, customers can place pickup or delivery orders, track orders, and manage accounts. Administrators manage orders, catalogue, stock, promotions, settings, and reports in `/admin`. PayHere and order emails can be enabled by environment settings. AI-assisted workflows are later milestones.

## Run locally

Use Node.js 24.12 or newer within the 24.x release line and npm 11 or newer. Run these commands from the repository root.

~~~sh
npm ci
npm run dev
~~~

Open [the storefront](http://127.0.0.1:5173). Express exposes [GET /api/health](http://127.0.0.1:3001/api/health), also reachable [through Vite](http://127.0.0.1:5173/api/health). Press Ctrl+C to stop both development servers.

The default configuration starts the website in demo mode and the API health endpoint without environment files. To override the API address, copy the root `.env.example` to `.env` and update `HOST` or `PORT`. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `API_PROXY_TARGET` to the corresponding address. Restart both servers after changing settings.

| Command | Purpose |
| --- | --- |
| `npm run dev:web` | Start Vite on its own. |
| `npm run dev:api` | Start Express in watch mode. |
| `npm run typecheck` | Check TypeScript in both apps. |
| `npm run build` | Build the frontend and compile the API. |
| `npm run test:web` | Run the storefront Playwright tests after installing a Chromium browser. |
| `npm run start:api` | Run the compiled API after building. |
| `npm run preview:web` | Serve the frontend build locally. Run the API separately for the proxied health endpoint. |

## Connect a catalogue database

Copy the root `.env.example` to `.env` and set `MONGODB_URI` to your Atlas or local MongoDB replica set. To populate a development database, run `npm run seed:demo`. Set `VITE_CATALOGUE_MODE=api` in `apps/web/.env.local`, then restart the app. `GET /api/ready` reports the connection state, and `/menu` displays published database records in API mode.

To create the initial administrator, set `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` in the ignored environment and run `npm run create:admin`. The command creates a new account and preserves an existing account with the same email. Sign in, then open `/admin`. Remove the bootstrap password from local configuration after use.

The demo seed adds a Colombo delivery zone and the `FRESH10` sample coupon. Set `SITE_ORIGIN`, `SMTP_URL`, and `MAIL_FROM` to enable password reset emails. Supply SMTP credentials only in the ignored environment. Set `CLOUDINARY_URL` server-side to enable verified image uploads. Database branding settings take precedence when present. See [PayHere setup](docs/PAYHERE_SETUP.md) for sandbox configuration and the local simulator.

Use `npm run test:api` for the API suite and `npm run test:shop` for the browser checkout suite. The first run downloads a temporary MongoDB binary. See [API documentation](docs/API_DOCUMENTATION.md) and [database schema](docs/DATABASE_SCHEMA.md).

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | React and Vite frontend. |
| `apps/api` | Express and TypeScript backend. |
| `automation` | n8n workflow exports, instructions, and example payloads. |
| `docs` | Requirements, decisions, setup guides, and progress. |

Zestora uses a monorepo. Both apps live in one Git repository and npm installs their dependencies from the root using one lockfile. Each app declares the packages it uses and has its own development and build command.

For the next session, start with [project context](docs/PROJECT_CONTEXT.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md), then review the [architecture](docs/ARCHITECTURE.md), [storefront guide](docs/STOREFRONT.md), and [Git workflow](docs/GIT_WORKFLOW.md).
