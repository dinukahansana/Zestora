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
