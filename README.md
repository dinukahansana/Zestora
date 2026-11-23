# Zestora

**Freshness in Every Sip.**

Zestora is a configurable ordering and business management platform for juice bars and other beverage shops. It has an English/Sinhala storefront with a demo catalogue. The roadmap also covers ordering, administration, payments, and AI-assisted workflows.

## Run locally

Use Node.js 24.12 or newer within the 24.x release line and npm 11 or newer. Run these commands from the repository root.

~~~sh
npm ci
npm run dev
~~~

Open [the storefront](http://127.0.0.1:5173). Express exposes [GET /api/health](http://127.0.0.1:3001/api/health), also reachable [through Vite](http://127.0.0.1:5173/api/health). Press Ctrl+C to stop both development servers.

The default configuration works without environment files. To override the API address, copy the root `.env.example` to `.env` and update `HOST` or `PORT`. Copy `apps/web/.env.example` to `apps/web/.env.local` and set `API_PROXY_TARGET` to the corresponding address. Restart both servers after changing settings.

| Command | Purpose |
| --- | --- |
| `npm run dev:web` | Start Vite on its own. |
| `npm run dev:api` | Start Express in watch mode. |
| `npm run typecheck` | Check TypeScript in both apps. |
| `npm run build` | Build the frontend and compile the API. |
| `npm run test:web` | Run the storefront Playwright tests after installing a Chromium browser. |
| `npm run start:api` | Run the compiled API after building. |
| `npm run preview:web` | Serve the frontend build locally. Run the API separately for the proxied health endpoint. |

## Repository layout

| Path | Purpose |
| --- | --- |
| `apps/web` | React and Vite frontend. |
| `apps/api` | Express and TypeScript backend. |
| `automation` | n8n workflow exports, instructions, and example payloads. |
| `docs` | Requirements, decisions, setup guides, and progress. |

Zestora uses a monorepo. Both apps live in one Git repository and npm installs their dependencies from the root using one lockfile. Each app declares the packages it uses and has its own development and build command.

For the next session, start with [project context](docs/PROJECT_CONTEXT.md) and [implementation status](docs/IMPLEMENTATION_STATUS.md), then review the [architecture](docs/ARCHITECTURE.md), [storefront guide](docs/STOREFRONT.md), and [Git workflow](docs/GIT_WORKFLOW.md).
