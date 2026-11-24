# Implementation status

## Phase 0

| Area | Status |
| --- | --- |
| Git and GitHub | Initialized and verified. `main` tracks `origin/main`. Commit `7ed1063` contains the initial ignore rules. |
| Monorepo | npm workspaces established for React/Vite and Express, with shared root scripts and one lockfile. |
| Frontend | Starter page and link to the proxied API health route. |
| Backend | Express liveness endpoint and optional local host and port settings. |
| Configuration | Root API and web proxy environment templates. No external service settings required. |
| Documentation | Initial requirements, architecture, workflow guides, status, and mentoring notes in `docs`. |
| Checks | Clean `npm ci`, both TypeScript checks, both builds, and Chrome smoke checks in development and local preview passed. The API returned the expected JSON both directly and through Vite. Custom local port settings also passed. |

The starter page and health endpoint are the two implemented features. MongoDB Atlas, Cloudinary, PayHere, n8n, AI, authentication, ordering, and deployment configuration remain for their roadmap milestones.

## Phase 1

| Area | Status |
| --- | --- |
| Storefront | Responsive homepage, navigation, demo menu, product pages, About, Gallery, Contact, FAQ, and four policy previews. |
| Locales | English and Sinhala resources, bilingual products, persistent language choice, and Sinhala fonts. |
| Catalogue | Six clearly labeled demo products with sharing-friendly search, sorting, and filters. Product pages show size, add-on, and quantity previews. |
| Media | Eight original, optimized WebP product and lifestyle images. |
| Contact | Shop contact channels and email-draft form work with public business settings. A live shop supplies its own contact information and approved policies. |
| Checks | TypeScript, both production builds, and six Chromium browser scenarios passed. Reviewed desktop and mobile homepage layouts. |

## Phase 2

| Area | Status |
| --- | --- |
| Data | Mongoose models and indexes for categories, products, users, and sessions. Seed and explicit admin bootstrap commands. |
| Catalogue | Published product and category APIs with validated filters, a health and readiness check, and database-backed storefront mode. |
| Accounts | Registration, login, logout, session lookup, and server-side role protection. Browser account pages are part of Phase 3. |
| Security | Salted scrypt password hashes, hashed and expiring sessions, production HTTPS cookies, request validation, authentication rate limits, origin checks, and standard security headers. |
| Verification | Production builds and type checks, eight API cases against a temporary MongoDB replica set, six storefront tests, and an API-backed browser smoke check. MongoDB Atlas setup is documented for a hosted environment. |

## Phase 3

| Area | Status |
| --- | --- |
| Cart | Browser-persisted cart with size, add-ons, quantity, and removal. |
| Checkout | Guest and signed-in pickup or delivery, server quotes, coupon and delivery calculations, one-time checkout keys, and order confirmation. Cash payments are recorded as pending at order creation. |
| Tracking | Guest reference plus tracking key. Signed-in customers see their own orders and can reorder from history. |
| Accounts | Registration, sign-in and sign-out, profile name, saved addresses, and single-use reset links. External mail delivery uses the configured SMTP service. |
| Verification | Type checks, both builds, thirteen API cases, six storefront cases, and two browser orders against a local MongoDB replica set. Reset email contents and token consumption were verified with a test mailer. |

## Phase 4

| Area | Status |
| --- | --- |
| Admin portal | Role-protected workspace for products, categories, customer history, inventory, coupons, business settings, and reports. |
| Orders | Search and filters, order details, permitted fulfilment transitions, cash payment confirmation, and order printing. |
| Reports | MongoDB-derived counts, paid revenue in day/week/month groupings, popular items, recent orders, and low-stock warnings. |
| Business management | Shared shop record for branding, contact details, language preference, availability, zones, fees, and notification and AI preferences. |
| Security | Admin-only writes and image uploads. Mutations save audit records, and images are validated and re-encoded before provider calls. |
| Verification | Seventeen API tests, four database-backed browser cases, six storefront browser cases, type checks, and both builds. Cloudinary upload behavior was tested against a captured provider interface. |

## Phase 5

| Area | Status |
| --- | --- |
| PayHere | Server-generated hosted checkout forms, signed callback verification, stored payment state, idempotent settlement, chargeback handling, and a verified-status return page. |
| Simulator | Development-only browser flow for decline and success. Test payments are marked and excluded from real revenue. |
| Notifications | Localized SMTP receipts and order updates, one persisted email job per order event, and failure tracking. |
| Verification | Twenty API tests, five database-backed browser tests, type checking, and both builds. PayHere callbacks used synthetic test credentials. The external sandbox and real SMTP tests require service configuration. |

## Phase 6

| Area | Status |
| --- | --- |
| Outbox | Transactions save domain changes and their minimal events together. Events remain queued when delivery is disabled. |
| Delivery | Timestamped HMAC, expiring worker claims, increasing retry delays, acknowledgement, and failed-event replay. |
| n8n | Three published workflows verified in a local n8n 2.48.8 instance, including order-created and order-status notifications and the shared event workflow. A duplicate delivered no additional email. |
| Monitoring | The admin Automation tab lists status and attempts and requeues terminal failures. |
| Checks | Twenty-one API cases, eleven browser cases, type checks and both builds, and the n8n integration smoke test. |

## Phase 7

| Area | Status |
| --- | --- |
| Customer AI | Bilingual assistant and recommendations use the current catalogue, apply exclusions, and verify guest or owner order access before returning a status. |
| Administration | Saved reports, feedback summaries, ingredient usage, and reviewable marketing drafts and approval. |
| Stock | Product recipes reserve ingredients in the same transaction as an order. Cancelling restores stock exactly once. Low-stock notices use the outbox. |
| n8n | Nine published workflows exercised in local n8n 2.48.8. Four synchronous AI tasks and two new event workflows included a controlled local model endpoint and captured mail transport. |
| Checks | Type checking, both builds, API integration tests, browser storefront and shop checks, and n8n integration. A commercial model account can be configured independently. |

## Phase 8

| Area | Status |
| --- | --- |
| Reports | An hourly n8n trigger saves one snapshot for each latest closed day, Monday-based week, and month in Colombo time. |
| Communications | Checkout offers a one-time feedback invitation per order. A signed event starts the job after completion, with one send attempt recorded separately from workflow delivery. |
| Recommendations | Current catalogue, availability, and exclusions remain authoritative. Eligible completed paid baskets add product pairing evidence. |
| Demand | Ingredient estimates use recorded paid usage and require 15 orders across seven distinct days. Low-sample ingredients show an explicit empty state. |
| Monitoring | Filter workflows by status, see next retries and mail results, and check model outcomes, average duration, and tokens by feature. |
| Checks | 29 API cases, browser suites, type checking, both builds, and eleven workflows in n8n 2.48.8. A five-second test schedule verified repeated native triggers and the opted-in email workflow used a captured mail transport. |

## Phase 9

| Area | Status |
| --- | --- |
| Functional | Clean install, type checks, both production builds, 29 API cases, and 12 storefront and shop browser cases passed. The temporary demo command started, seeded the catalogue, and accepted its generated admin login. |
| Security | Dependency audit returned zero findings. Local HTTPS smoke passed for secure cookies, blocked cross-origin mutations, CSP, and separation of JSON API errors from React routes. |
| Performance and responsive | Main gzip bundle fell from about 123 KB to 105 KB. Fingerprinted assets are cacheable, and final smoke checks passed at 390 px and 1440 px. |
| Integrations | Eleven n8n workflows verified locally, including a native recurring trigger and duplicate feedback delivery handling. Payment verification and simulator tests passed using local fixtures. |
| Production | One-origin production hosting, a validated Render Blueprint, GitHub Actions, and a deployment runbook are ready. |
| External verification | Public hosting and Atlas connection are pending. Real PayHere Sandbox callbacks, SMTP, Cloudinary, hosted n8n, and the chosen model provider require their deployment settings. |
