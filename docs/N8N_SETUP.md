# n8n setup

n8n coordinates steps that run outside the storefront request. A trigger starts a workflow. Each node performs one action. In Zestora, a Webhook node receives a signed event and an HTTP Request node forwards it to Express for verification and processing.

## Local configuration

1. Start an n8n 2.x instance using the [installation guide](https://docs.n8n.io/deploy/host-n8n/install-options/install-with-npm.md) or the hosted service.
2. Import the eleven exports from `automation/workflows`. Point the HTTP Request nodes at the API's `/api/integrations/n8n/consume` endpoint for events and the `/api/integrations/n8n/ai` endpoint for AI task workflows. Configure the scheduled report workflow as described below. The local default uses port 3001.
3. Publish the workflows. Set `N8N_WEBHOOK_BASE_URL` to the production webhook base, such as `http://127.0.0.1:5678/webhook/` for local testing. Hosted deployments require HTTPS.
4. Configure a high-entropy `N8N_SHARED_SECRET` only in the API environment. n8n forwards the signed headers and does not need the secret.
5. Create an order or change its status, then check the **Automation** tab for the event, status, and attempt count.

| Workflow | Webhook path | Processing |
| --- | --- | --- |
| Order Created Notification | `zestora-order-created` | New orders and matching email jobs. |
| Order Status Notification | `zestora-order-status` | Order fulfilment status changes. |
| Zestora Business Events | `zestora-events` | Payment, catalogue, stock, and account events. |
| Assistant, recommendations, business report, marketing draft | `zestora-ai-assistant`, `zestora-product-recommendations`, `zestora-business-report`, `zestora-marketing-draft` | Verified synchronous AI tasks. |
| Customer Feedback Invitation | `zestora-customer-feedback` | One opt-in feedback email after completion. |
| Scheduled Sales Reports | Schedule Trigger | An API call using the separate Header Auth credential. |
| Feedback Analysis and Low Stock | `zestora-feedback-analysis`, `zestora-low-stock` | Review classification and store stock notices. |

The API checks the schema, HMAC signature, five-minute timestamp window, and stored event. On failure, the worker delays and retries the delivery, then records a terminal failure. Administrators can requeue a failed event. Each email job has a separate unique identity to guard against duplicate sends.

The JSON files in `automation/examples` show envelope shapes. An end-to-end run starts with an actual event stored by the API. The n8n exports suppress saving full payloads. The Zestora panel shows delivery results. When n8n is disabled, the main application still records business data and events, and configured order email can go directly through SMTP.


Phase 6 was verified with n8n 2.48.8 and a local MongoDB replica set. All three published workflows acknowledged signed events and replaying one did not issue another email.

## Scheduled reports and feedback

The Customer Feedback Invitation workflow forwards signed events to the same consumer. The event includes an order reference and no contact details. The API only creates the invitation when the customer opts in for that order and notifications are enabled.

The Scheduled Sales Reports workflow runs at minute 10 each hour in Asia/Colombo. Create a [Header Auth credential](https://docs.n8n.io/integrations/builtin/credentials/httprequest/) named for the shop, with header `x-zestora-schedule-key` and the same independent high-entropy value as API `N8N_SCHEDULE_KEY`. Select it in **Save closed-period reports** before publishing. The key stays in the credential store and the API environment. It is independent of the outbox HMAC key.

A successful tick saves the latest closed local day, Monday-to-Sunday week, and calendar month once. It picks up a missed run for those latest periods on the next tick. Longer outages may leave gaps, and the manual report remains available. See the [Schedule Trigger documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/) for publishing and timezone settings.
