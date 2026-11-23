# Testing

## Phase 0 checks

From the repository root, install with `npm ci`, then run `npm run typecheck` and `npm run build`. Start both applications with `npm run dev` and load the storefront starter. Check that `GET /api/health` responds with HTTP 200 and the documented JSON directly on port 3001 and through Vite on port 5173.

Verify the compiled API separately with `npm run start:api`. Start `npm run preview:web` to check the built frontend and its local API proxy. For an environment override check, set `PORT` in the root `.env` and the matching `API_PROXY_TARGET` in `apps/web/.env.local`. Check both direct and proxied requests after restarting. See [implementation status](IMPLEMENTATION_STATUS.md) for the latest results.

## Storefront browser checks

Install Chromium once with `npx playwright install chromium`, then run `npm run test:web` from the root. Set `PLAYWRIGHT_CHROME_PATH` to use an existing Chrome executable. The suite starts a separate development server with synthetic contact settings and exercises desktop and mobile routing, keyboard interaction, Sinhala persistence, catalogue filters, product options, and information pages.

## API integration tests

Run `npm run test:api`. Vitest orchestrates the suite, Supertest exercises Express routes, and a temporary MongoDB replica set stores the test records. The first invocation downloads its MongoDB binary. The tests cover seeding, public data boundaries, cookies, registration, login, logout, authorization, expiry, and validation.

## Planned test coverage

| Tool | Planned use |
| --- | --- |
| Vitest | Pricing, cart rules, coupon rules, status transitions, AI output validation, and workflow retry logic. |
| Supertest | API contracts, authentication, authorization, CRUD, order operations, payment verification, webhooks, and duplicate events. |
| Playwright | Responsive and bilingual navigation, guest checkout, tracking, and administrative flows. |

After each milestone, record commands, passed and failed checks, and anything still unverified. Use provider sandboxes or verified test instances for external integrations.
