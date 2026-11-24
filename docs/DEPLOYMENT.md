# Deployment

## Hosting

The repository includes a Render Blueprint for one Node.js service in Singapore. Express serves the built React frontend and API from the same HTTPS origin. This keeps cookies first-party and lets the outbox run continuously on an always-on service. MongoDB is hosted separately in Atlas. Cloudinary, PayHere, SMTP, n8n, and the model provider connect to the API from their own services. [Render web services](https://render.com/docs/web-services) · [Blueprint reference](https://render.com/docs/blueprint-spec)

The default Blueprint uses the Free plan for portfolio demos. Free services suspend after inactivity and block the common SMTP ports. Choose an always-on paid service for live ordering and background work. Render lists its smallest paid web instance at USD 7 per month before other services or usage charges. Recheck pricing and quotas when provisioning. [Free service limits](https://render.com/docs/free) · [Render pricing](https://render.com/pricing)

## Provision and configure

1. Create an Atlas cluster and a database user scoped to the Zestora database. Allow the application host's network egress in the Atlas project. Use distinct clusters or databases and credentials for staging and production. The API creates its collections and indexes on startup. [Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
2. Connect the repository's `main` branch in Render and apply `render.yaml`. Set `MONGODB_URI` in the dashboard. The build runs `npm ci` and `npm run build` with `VITE_CATALOGUE_MODE=api`. The start command uses `SERVE_WEB=true`, `NODE_ENV=production`, and the host-assigned port. The health gate checks `/api/ready`. Validate the intended compute plan before provisioning.
3. By default the Render URL supplies the site and allowed origin. If you use a custom domain, set `SITE_ORIGIN` and `ALLOWED_ORIGINS` to the exact public HTTPS origin and verify `TRUST_PROXY_HOPS` against the deployed proxy chain.
4. Run the explicit `npm run create:admin` command from a secure environment that can connect to the target database. Supply the three admin bootstrap values only for that command. Use `npm run seed:demo` only against a demonstration database. Configure the live menu, fulfilment settings, contact details, and applicable business policies before accepting real orders.
5. Add optional server-only credentials using the provider dashboard. Follow the PayHere, n8n, and AI guides. Keep the SMTP relay, sender verification, and Cloudinary upload access scoped to this environment. Set the n8n API origin in each HTTP Request node, publish the workflows, and attach the separate Header Auth credential to the scheduled workflow.

## Validate the deployed service

- Visit the public site and a direct menu link. Confirm `/api/health` and `/api/ready` return 200 and that signed-in admin pages work over HTTPS. Check delivery, pickup, and an order transition on test accounts.
- In staging, run a PayHere sandbox success and failure. Verify the public HTTPS `notify_url` updates the order before treating a payment as settled. Keep the live switch off until verification and merchant approval. [PayHere Checkout API](https://support.payhere.lk/api-%26-mobile-sdk/checkout-api)
- Upload and remove a test product image, send a test account reset and order email, run the n8n workflows and their retry path, and verify one request against the chosen model provider. Match the logs to the relevant order, workflow, or model usage record.
- Monitor the application health endpoint and admin Automation tab. Check database backups and rehearse restore in staging. For code rollback, deploy the previous tested commit from deployment history and verify readiness again. Review data compatibility before a database restore. [Render rollbacks](https://render.com/docs/rollbacks)

The built application can be exercised locally over HTTPS with `npm run test:production` after an API-mode build. See [testing](TESTING.md) for details and [implementation status](IMPLEMENTATION_STATUS.md) for external checks.
