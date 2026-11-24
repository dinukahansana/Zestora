# Learning notes

## Phase 0

| Concept | Zestora example |
| --- | --- |
| Monorepo | The storefront and API share the same Git history. npm workspaces let us install both apps from the repository root with one lockfile. |
| Frontend | `apps/web/src/App.tsx` renders the starter page. Vite serves it during development and bundles it for deployment. |
| Backend | `apps/api/src/app.ts` defines the health route. `server.ts` starts the HTTP server so it can receive requests. Later, the API will also own private credentials, order logic, and database access. |
| Local proxy | Opening `/api/health` on the web server sends the request through Vite to Express. A proxy forwards requests to another server. |
| Environment variables | `PORT` changes the API's listening port without editing TypeScript. An example file documents supported settings. The actual local `.env` is ignored by Git. |
| Verification | Type checking finds TypeScript errors, building produces deployable files, and requesting the live health endpoint verifies that the processes communicate. |
| Git | `git status` shows changes. Staging selects them. A commit records the snapshot. `git push` publishes commits to the configured GitHub remote. The owner has authorized publication of verified phase commits. |

## Phase 1

| Concept | Zestora example |
| --- | --- |
| Design tokens | `apps/web/src/index.css` defines shared colors and type. Navigation, cards, and forms reuse those choices so a theme change updates the site consistently. |
| Client-side routes | `App.tsx` maps URLs to pages. The layout stays mounted as the customer moves from the menu to a product and back. |
| Translation resources | `src/locales` has English and Sinhala dictionaries. i18next looks up the active text. `i18n.ts` stores the language in the browser and updates the document language for assistive technology. |
| Search parameters | `/menu?category=juices` records a filter in the URL. Refreshing or sharing that address preserves the same catalogue view. |
| Derived state | The product page stores chosen size, add-ons, and quantity. It calculates a preview total from those inputs whenever a choice changes. The ordering phase will validate and compute actual totals on the API. |
| Browser verification | Playwright interacts with product controls, navigates pages, checks translated content, and repeats the smoke flow at phone size. |

## Phase 2

| Concept | Zestora example |
| --- | --- |
| MongoDB document | A product document holds its description in both languages and a list of its sizes. Products refer to a category by its slug. |
| Mongoose model and index | The catalogue model describes product fields. A unique email index prevents two requests from creating duplicate accounts. |
| Input validation | Zod checks the shape of a request before it reaches MongoDB. Account registration accepts a name, email, and password. The API assigns the role. |
| Password vs. session | Login checks a salted password hash. The HTTP-only cookie then carries a separate random token. The API compares a hash of that token and checks that the associated session still exists. |
| Server state | TanStack Query fetches the catalogue, shares it across pages, and can retry after a temporary outage. It treats an API failure as an error state. |
| Readiness | A health check shows Express can answer. A readiness check shows it can reach the database required for products and accounts. |

## Phase 3

| Concept | Zestora example |
| --- | --- |
| Shared browser state | Zustand keeps the selected items, sizes, add-ons, and quantities in browser storage. Reloading the page restores the cart. |
| Server-side pricing | Express reads current product options, applies the coupon, and adds the delivery fee. Checkout asks you to review a changed total before creating the order. |
| Transaction | MongoDB saves the order and redeems the coupon together. That prevents two customers from claiming the last use of a coupon. |
| Idempotency | The browser sends a unique checkout key. If a connection drops, an identical retry returns the same order instead of placing another one. |
| Guest access | A public order reference identifies the order. A separate tracking key proves access. Signed-in customers use their session for their own orders. |
| Password reset | A time-limited email link carries a single-use key. Resetting the password consumes the key and ends previous sessions. |

## Phase 4

| Concept | Zestora example |
| --- | --- |
| Role-based access | Express requires an administrator session on every `/api/admin` route. The dashboard UI also checks the role so customers see an appropriate message. |
| Audit record | The API saves an action such as cash payment confirmation in the same MongoDB transaction as the data change. |
| Revenue aggregation | MongoDB groups eligible paid orders by their payment date. The chart displays those computed amounts and can group by day, week, or month. |
| Publication | Archiving a product hides it from the public menu. Earlier orders retain their own product and price snapshots. |
| Business configuration | Delivery fees and branding are stored with the shop. Changing the fee changes the next server quote, and the website reads the updated brand. |
| Image upload | The API decodes allowed formats, applies dimension and payload limits, re-encodes the image as WebP, then uploads with server-side Cloudinary credentials. |

## Phase 5

| Concept | Zestora example |
| --- | --- |
| Hosted checkout | The API sends PayHere a signed form built from the MongoDB order. Customers enter payment details on the gateway. |
| Callback | PayHere makes a server-to-server request after processing the payment. Zestora verifies its signature, amount, currency, and order reference before persisting an update. |
| Verified return | The return page asks Express for the stored status. It can show Pending if the browser returns before the callback arrives. |
| Idempotent payment | Repeated successful notifications keep the same payment and settlement time. A chargeback updates settlement separately from order fulfilment. |
| Email job | Each order event has one notification key. A failed mail job is recorded while the order remains available. |

## Phase 6

A transactional outbox saves a business change and its event together. The worker claims the event after that transaction commits. n8n receives it at a Webhook node and returns it to Express for signature verification. Delivery failures can retry without recreating the order. The separate email job key keeps a repeated event from sending a second message.

## Phase 7

The assistant uses the model to decide what the question is asking. Express then renders the answer from current menu records. An invented slug from the model cannot turn into a drink or price in the storefront. Order access needs proof of ownership, so the model never sees customer order details.

A verified review and its derived sentiment are separate records. Owners can revisit what the customer actually wrote. Reports use the same separation for sales data and generated narrative. Marketing drafts have a distinct approval state so the owner controls what gets shared.

A recipe maps a drink to inventory quantities. The order and the stock reservation commit together, and cancelling restores that reservation once. Crossing a configured threshold records a low-stock event for n8n.

## Phase 8

A Schedule Trigger calls the API once an hour. The API calculates the latest closed day, week, and month in Colombo time. A unique period key and a short-lived claim let concurrent ticks share the same work. Whenever the service restarts, the next successful tick fills the latest periods.

A one-time feedback invitation is an opt-in on each order. Completing a consenting order saves an email job and an event in the same transaction. The job key keeps n8n retries from sending it twice. The Automation tab shows whether Express acknowledged the workflow and whether the email actually sent.

Pairing recommendations use counts from completed paid baskets. Each basket counts once per item. The API checks the current published menu and ingredient exclusions before returning any suggestion. Demand uses 30 days of recorded ingredient usage on eligible sales. It estimates the next seven days only after 15 orders across seven distinct days. The estimate is a simple rate and does not model seasonality.

The Insights tab shows model attempts, successful responses, average duration, and token counts by feature. This helps an owner spot a slow or unreliable model while keeping prompts out of usage logs.

## Phase 9

Serving React and Express under one HTTPS origin simplifies how the browser sends a secure session cookie. React handles storefront URLs like `/menu/golden-mango`. Express still answers `/api` URLs and returns JSON for missing endpoints.

A fingerprinted asset filename changes with its content, so browsers can cache that URL for a year while rechecking the storefront HTML. Loading the home animation as a separate chunk reduced the main gzip bundle from about 123 KB to 105 KB. The browser can display the headline while the animation code loads.

CI installs from the lockfile and reruns release tests against a temporary database. Deploying that same commit to a host adds the real database, domain, and provider configuration. A local HTTPS test can verify cookies and routes. Only the gateway's actual sandbox can verify that PayHere reaches a public callback.
