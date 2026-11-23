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
