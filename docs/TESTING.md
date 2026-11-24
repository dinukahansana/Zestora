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

## Automation tests

The API suite covers transactional event capture, signing, stale and altered messages, concurrent delivery claims, workflow outages, duplicate acknowledgement, and manual retry. See the [n8n setup](N8N_SETUP.md) for the published workflow paths and external test procedure.

## Test coverage

| Tool | Coverage |
| --- | --- |
| Vitest | Pricing, cart rules, coupon rules, status transitions, AI output validation, and workflow retry logic. |
| Supertest | API contracts, authentication, authorization, CRUD, order operations, payment verification, webhooks, and duplicate events. |
| Playwright | Responsive and bilingual navigation, guest checkout, tracking, and administrative flows. |

After each milestone, record commands, passed and failed checks, and anything still unverified. Use provider sandboxes or verified test instances for external integrations.

## AI and inventory tests

The API suite tests current prices, tracking authorization, redaction and response validation against a controlled local model endpoint, draft approval, review ownership and uniqueness, and transactional stock usage and restoration. The shop browser suite reaches the assistant, filtered recommendations, reports, and draft approval through their normal routes. A configured commercial model account is needed to verify that deployment's provider and quota.

## Release verification

Run a clean `npm ci`, then type checking, the production build, the API suite, both browser suites, and `npm audit --audit-level=high`. Build with `VITE_CATALOGUE_MODE=api` before `npm run test:production`. On PowerShell, set `$env:VITE_CATALOGUE_MODE='api'` before the build. On a POSIX shell, run `VITE_CATALOGUE_MODE=api npm run build`. The production smoke uses OpenSSL, a temporary certificate and MongoDB replica set, and Chromium. Use `ZESTORA_OPENSSL_PATH` and `PLAYWRIGHT_CHROME_PATH` to override their discovery.

The smoke test serves the built apps over one local HTTPS origin. It verifies the secure admin cookie, blocked cross-origin mutations, the PayHere form policy, immutable caching for fingerprinted files, JSON API 404s, refreshed React routes, and 390 px mobile layouts. It also verifies the simulator is unavailable in production. GitHub Actions runs these checks on pushes to main and pull requests.
