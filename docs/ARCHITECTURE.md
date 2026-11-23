# Architecture

## Current system

The repository has two npm workspaces. `apps/web` serves the bilingual React storefront through Vite. React Router matches storefront paths and i18next resolves interface and language preference settings. The storefront supports the local demo catalogue and a database-backed catalogue mode. In API mode, TanStack Query loads and caches the result of `/api/catalogue` and exposes loading and error states. See [storefront](STOREFRONT.md). `apps/api` defines the Express application in `src/app.ts` and starts the listener in `src/server.ts`. Separating the app from the listener makes the routes easier to test later.

~~~mermaid
flowchart LR
    Browser -->|Starter page and /api/health| Vite
    Vite -->|Forward /api requests| Express
    Express -->|Health JSON| Vite
~~~

In local development, the browser requests `/api/health` at the same address as the frontend. Vite forwards it to Express, so the browser does not need a separate development CORS setup. The Vite proxy also supports local build previews. Production hosting needs its own API routing or an explicit API origin and CORS configuration.

## Planned system

- **React** handles navigation, display, cart interactions, forms, and translations. The API supplies data and validates requests.
- **Express and MongoDB currently** serve catalogue, accounts, orders, and checkout pricing. A MongoDB transaction links an order and its coupon usage. The admin workspace adds inventory, order operations, and reporting queries. The PayHere workflow comes next. Mongoose defines persistence models.
- **Cloudinary** stores images. MongoDB stores image references and business records.
- **PayHere** receives payment requests and sends status notifications to a verified backend endpoint. The browser return page reads backend payment state.
- **n8n** orchestrates notifications, schedules, and calls to approved services. Use an outbox to record a business change and its pending automation event together where appropriate.
- **AI providers** turn authorized, validated inputs into language responses or structured suggestions. The backend authenticates requests, validates outputs, and calculates business metrics independently.

For example, the API will create an order with its outbox event, then a delivery worker will send a signed event to n8n. n8n can notify the shop and customer while the original order remains available even if delivery fails. See [AI and automation](AI_AUTOMATION_SPECIFICATION.md) for event details.
