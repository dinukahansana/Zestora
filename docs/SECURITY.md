# Security

## Current baseline

- Local servers bind to loopback by default. Express omits the framework identification header.
- The only API route is public liveness and returns a service identifier and status.
- Git ignores local environment files, common key and credential files, build output, and logs. The two `.env.example` files contain only local defaults.
- Keep real API keys, signing secrets, connection strings, passwords, merchant credentials, and n8n credentials outside the repository. Check the staged diff before each commit.

## Implementation requirements

- Hash passwords, use secure sessions and role-based authorization, and use a secure setup process for the initial administrator. Require guest order verification.
- Validate requests, queries, uploads, and AI outputs. Protect against NoSQL injection, unauthorized access, excessive traffic, and information leakage. Configure headers, CORS, and safe error responses for production.
- Keep credentials on the server and restrict logging and retention of customer data. Record administrative operations in an audit log.
- Calculate prices and inventory changes on the API. Verify PayHere notifications with the server-side checksum and process callbacks idempotently.
- Verify n8n webhook signatures and timestamps. Reject invalid or replayed requests and use unique event IDs to avoid duplicate side effects.
- Use verified business data for AI and validate all generated references or suggested values before business logic consumes them.
