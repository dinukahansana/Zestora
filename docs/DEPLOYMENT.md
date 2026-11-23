# Deployment

Phase 0 runs locally. Choose hosting in the deployment milestone after verifying costs, limits, and compatibility. The intended topology is Vercel or a comparable frontend host, a Node.js API host, MongoDB Atlas, Cloudinary, and hosted or self-hosted n8n.

## Build and configuration

- Build from the root with `npm ci` and `npm run build`. The frontend output is `apps/web/dist`. The API output is `apps/api/dist` and starts with `npm run start:api`.
- The documented local hosts are `127.0.0.1`. A deployment may need `HOST=0.0.0.0` and the `PORT` set by its hosting provider.
- Set frontend API routing on the host. The Vite proxy is for development and local preview.
- Configure production credentials using each provider's secret settings. Prepare database connectivity and required indexes, scoped Cloudinary access, HTTPS, approved frontend origins, and secure session settings as those features are introduced.
- Set n8n credentials and webhook signing settings. Verify payloads, status notifications, and retry behavior before enabling workflows.
- Use PayHere sandbox first and check callback URLs, server-side checksum validation, and duplicate handling. Live mode requires merchant credentials, registered callback URLs, and approval.

The production review includes security and performance, mobile layouts, integration tests, monitoring, backup and rollback procedures, and documentation.
