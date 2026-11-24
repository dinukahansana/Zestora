# Security

## Current baseline

- Local servers bind to loopback by default. Express omits the framework identification header.
- Public health and readiness responses expose service status. Public catalogue queries return published records and select public fields.
- Git ignores local environment files, common key and credential files, build output, and logs. The two `.env.example` files contain only local defaults.
- Keep real API keys, signing secrets, connection strings, passwords, merchant credentials, and n8n credentials outside the repository. Check the staged diff before each commit.

- Accounts use salted scrypt hashes. Session cookies are HTTP-only and secure in production. MongoDB stores a hash of each random session token and expires it with a TTL index. The API still checks expiry on every session read.
- Helmet supplies security headers. Zod validates requests, specified origins can mutate records, authentication requests are throttled, and admin access requires an authorized session.
- Production should route browser API requests through the storefront origin for same-site cookies. Set only the trusted reverse proxy hop count and the allowed frontend origins for the deployment.

- Checkout recomputes fees and totals on the API. A scoped checkout key deduplicates a repeated order, and MongoDB stores coupon redemption with the order in one transaction.
- Guest order access requires a separate key stored as a hash. Customer order and address requests check the active account owner. Password reset tokens expire, are single-use, and revoke active sessions.

- Admin mutations check the user role and save an audit record. Image uploads require admin authorization, a bounded payload and dimensions, and decoder validation. The API strips original metadata by writing a fresh WebP.

- PayHere payment responses are verified on the API against the merchant, signature, order amount, currency, and environment. The receipt page reads server state. Sandbox and simulator outcomes are labeled and excluded from live revenue.

- Automation events contain a stable resource ID and minimal fields. The API verifies a timestamped HMAC and checks the stored record before acknowledging a workflow. Job claims, retry limits, and a separate mail job key prevent duplicate side effects.

## Implementation requirements

- Hash passwords, use secure sessions and role-based authorization, and use a secure setup process for the initial administrator. Require guest order verification.
- Validate requests, queries, uploads, and AI outputs. Protect against NoSQL injection, unauthorized access, excessive traffic, and information leakage. Configure headers, CORS, and safe error responses for production.
- Keep credentials on the server and restrict logging and retention of customer data. Record administrative operations in an audit log.
- Calculate prices and inventory changes on the API. Verify PayHere notifications with the server-side checksum and process callbacks idempotently.
- Verify n8n webhook signatures and timestamps. Reject invalid or replayed requests and use unique event IDs to avoid duplicate side effects.
- Use verified business data for AI and validate all generated references or suggested values before business logic consumes them.

## Production review

The production same-origin server requires MongoDB and an explicit public HTTPS origin. Express serves only the compiled public distribution. Unknown API routes keep their JSON error response. The Content Security Policy allows Cloudinary images and the two documented PayHere checkout origins. The secure session cookie and allowed-origin rules were tested through a local HTTPS reverse proxy.

Secrets stay in provider settings or an ignored local environment. Separate staging from production because a sandbox order can reserve stock in its own database. The n8n schedule credential is distinct from the event HMAC secret. Mail delivery status is separate from workflow delivery. An interrupted SMTP send can have an uncertain outcome, so the application avoids automatically resending a claimed message.
