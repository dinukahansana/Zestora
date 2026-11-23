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

## Next milestone

Phase 5 adds PayHere sandbox checkout, verified server callbacks, payment persistence, and customer notifications.
