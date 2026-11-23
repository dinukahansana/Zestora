# API documentation

The API uses JSON. Local requests can go directly to `http://127.0.0.1:3001` or through the Vite `/api` proxy.

## Health and readiness

| Method and path | Responses |
| --- | --- |
| `GET /api/health` | HTTP 200 with `{"status":"ok","service":"zestora-api"}` when Express is running. |
| `GET /api/ready` | HTTP 200 with `{"status":"ready","database":"connected"}` when MongoDB is connected, or 503 with `{"status":"unavailable","database":"disconnected"}`. |

## Public catalogue

| Method and path | Success body |
| --- | --- |
| `GET /api/catalogue` | `{ categories, products }` for the storefront. |
| `GET /api/categories` | `{ items }` ordered by position and slug. |
| `GET /api/products` | `{ items, offset, limit, total }`. Optional `category`, `available`, `featured`, `sort` (`featured`, `low`, `high`, `name`), `offset`, and `limit` query parameters. Defaults are featured, 0, and 24. The maximum page size is 100. |
| `GET /api/products/:slug` | `{ item }`, or 404 for a missing or unpublished product. |

Only products in published categories appear. Both languages are returned on product names, descriptions, ingredients, sizes, and add-ons. Prices are whole LKR. A demo item includes `demo: true`.

## Accounts and administration

| Method and path | Input and response |
| --- | --- |
| `POST /api/auth/register` | Send `{ name, email, password }`. Returns 201 with `{ user }` and a session cookie. |
| `POST /api/auth/login` | Send `{ email, password }`. Returns 200 with `{ user }` and a fresh session cookie. |
| `GET /api/auth/me` | Returns 200 with `{ user }` from the current session, or 401. |
| `POST /api/auth/logout` | Revokes the presented session, expires the cookie, and returns 204. |
| `GET /api/admin/catalogue` | Requires an admin session. Returns `{ categories, products }`, including unpublished catalogue records. |

The public user object is `{ id, name, email, role }`. Registered accounts start as customers. The admin bootstrap command creates initial administrator accounts explicitly. Passwords need 12 to 128 characters on creation. Session cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` in production.

## Errors

Error responses use `{ error: { code, message, fields? } }`. Invalid input uses 400, missing sessions 401, insufficient role or denied mutation origins 403, unavailable records 404, duplicate account creation 409, authentication throttling 429, and database unavailability 503. Validation problems can include `fields: [{ field, message }]`.

## Ordering and profiles

| Method and path | Request and response |
| --- | --- |
| `GET /api/shop/checkout` | Pickup and delivery availability, delivery zone names and fees, and minimum order. |
| `POST /api/orders/quote` | Send `{ items, fulfillment, coupon? }`. Each item is `{ productSlug, sizeId, addOnIds, quantity }`. Fulfilment is `{ type: "pickup" }` or `{ type: "delivery", zoneId }`. Returns priced items, totals, and LKR currency. |
| `POST /api/orders` | Add `customer: {name,email,phone}`, `expectedTotal`, a UUID `checkoutKey`, and a guest key for a guest. Delivery also requires `address` and allows `instructions`. Either option can include an ISO `preferredAt`. Optional `notes` and coupon are accepted. Returns `{ order }` with HTTP 201, or HTTP 200 for an identical retry. |
| `POST /api/orders/track` | Send `{ reference, key }` for an order placed without an account. |
| `GET /api/orders/mine` | Returns the signed-in customer's latest 100 orders as `{ orders }`. |
| `GET /api/orders/mine/:reference` | Returns `{ order }` only to its owner. |
| `GET /api/account` | Returns `{ user, addresses }` to the signed-in customer. |
| `PATCH /api/account` | Update the account name with `{ name }`. |
| `POST /api/account/addresses` | Add a saved `{ label, address }`. |
| `PATCH /api/account/addresses/:id` | Update a saved `{ label, address }` owned by the customer. |
| `DELETE /api/account/addresses/:id` | Remove a saved address owned by the customer. Returns 204. |
| `POST /api/auth/forgot-password` | Send `{ email, language? }`. Returns 202 if email delivery is configured. |
| `POST /api/auth/reset-password` | Send `{ key, password }`. Consumes the expiring key and revokes existing sessions. Returns 204. |

Checkout recalculates every price and delivery fee. A total change returns `TOTAL_CHANGED` with HTTP 409. A completed checkout keeps an immutable pricing snapshot of each product and option. The guest tracking key is a URL-safe 32-byte random string. The browser retains the key and the API stores its hash. A reference alone cannot retrieve a guest order.
