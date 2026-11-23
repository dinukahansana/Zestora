# Project context

Zestora is a reusable online ordering and business management platform for juice bars, smoothie shops, milkshake shops, and similar beverage businesses. The first implementation should support a portfolio demonstration and be configurable for other shops through branding, products, prices, delivery rules, payment configuration, and workflow settings.

The working brand is **Zestora** with the tagline **Freshness in Every Sip.** The visual direction is fresh, modern, premium, and welcoming, with fresh greens, cream and white backgrounds, natural fruit colors, and product photography. The first market is Sri Lanka, with LKR prices and English and Sinhala interfaces. Domain and trademark checks are pending.

## Confirmed stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS, React Router, TanStack Query, Zustand, Framer Motion, Lucide React, React Hook Form, Zod, i18next, and react-i18next |
| Backend | Node.js, Express, TypeScript, Zod, Mongoose, REST APIs |
| Data and images | MongoDB Atlas for persistence and Cloudinary for images |
| Automation and AI | n8n for workflows and a configurable server-side LLM provider |
| Payments | PayHere sandbox, followed by live setup after merchant approval and verification |
| Testing | Vitest, Supertest, and Playwright as relevant |
| Deployment | Vercel or equivalent for the frontend, Node.js hosting for the API, and hosted or self-hosted n8n. Provider selections are pending. |

Use the confirmed stack unless a technical constraint calls for a change. Explain the constraint and proposed change before implementing it.

## How we work

Develop one milestone at a time. Inspect the code and Git status, explain the planned change, build it, run checks, and update the documentation. Explain major concepts in plain English using real Zestora examples, including where the feature lives, how it works, and what matters for security and performance. Ask before pushing to GitHub.

Each session should start with this document and [implementation status](IMPLEMENTATION_STATUS.md). Read the relevant feature documents before editing and leave the repository with an updated progress record and a clear next task.

Phase 0 establishes separate frontend and API workspaces, a health endpoint, and project documentation. See [implementation status](IMPLEMENTATION_STATUS.md) for what has been verified and what comes next.
