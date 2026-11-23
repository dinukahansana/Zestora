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
