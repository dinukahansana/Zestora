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
| Git | `git status` shows changes. Staging selects them. A commit records the snapshot. `git push` publishes commits to the configured GitHub remote after approval. |
