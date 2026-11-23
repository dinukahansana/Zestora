# Testing

## Phase 0 checks

From the repository root, install with `npm ci`, then run `npm run typecheck` and `npm run build`. Start both applications with `npm run dev` and load the storefront starter. Check that `GET /api/health` responds with HTTP 200 and the documented JSON directly on port 3001 and through Vite on port 5173.

Verify the compiled API separately with `npm run start:api`. Start `npm run preview:web` to check the built frontend and its local API proxy. For an environment override check, set `PORT` in the root `.env` and the matching `API_PROXY_TARGET` in `apps/web/.env.local`. Check both direct and proxied requests after restarting. See [implementation status](IMPLEMENTATION_STATUS.md) for the latest results.

## Storefront browser checks

Install Chromium once with `npx playwright install chromium`, then run `npm run test:web` from the root. Set `PLAYWRIGHT_CHROME_PATH` to use an existing Chrome executable. The suite starts a separate development server with synthetic contact settings and exercises desktop and mobile routing, keyboard interaction, Sinhala persistence, catalogue filters, product options, and information pages.

## API integration tests

Run `npm run test:api`. Vitest orchestrates the suite, Supertest exercises Express routes, and a temporary MongoDB replica set stores the test records. The first invocation downloads its MongoDB binary. The tests cover seeding, public data boundaries, cookies, registration, login, logout, authorization, expiry, and validation.

## Checkout integration tests

Run `npm run test:shop` with Chromium. The suite starts Vite, Express, and a temporary MongoDB replica set. It exercises real guest delivery, account pickup, saved addresses, tracking, and reordering. API tests also check idempotency, coupon usage races, authorization, and the lifetime of a password reset link.

## Administration tests

`npm run test:api` covers admin roles, public publication, cash and status transitions, audit records, low stock, database revenue, configurable fees and branding, and image normalization. The browser shop suite covers admin sign-in, catalogue manipulation, settings, order confirmation, and print access. The image provider contract is tested with a captured upload. A Cloudinary account is required to verify an external upload.

## Payment tests

The API suite sends synthetic signed and invalid test callbacks to Express. It verifies exact amount matching, duplicate delivery, a chargeback, authorization, simulator isolation, and an SMTP failure. The browser shop suite exercises simulated failure and success. External sandbox callbacks need the approved PayHere configuration and a public endpoint.

## Planned test coverage

| Tool | Planned use |
| --- | --- |
| Vitest | Pricing, cart rules, coupon rules, status transitions, AI output validation, and workflow retry logic. |
| Supertest | API contracts, authentication, authorization, CRUD, order operations, payment verification, webhooks, and duplicate events. |
| Playwright | Responsive and bilingual navigation, guest checkout, tracking, and administrative flows. |

After each milestone, record commands, passed and failed checks, and anything still unverified. Use provider sandboxes or verified test instances for external integrations.
