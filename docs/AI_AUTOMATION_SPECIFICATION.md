# AI and automation specification

## AI features

| Feature | Requirements |
| --- | --- |
| Customer assistant | Answer from verified menus, ingredients, sizes, prices, availability, hours, fulfilment and policies. Support English and Sinhala, route uncertainty to human help, and verify ownership before showing order information. |
| Recommendations | Use preferences, availability, product characteristics, complementary items, and permitted history. Return product IDs and explanations. Validate IDs, prices, and availability, with a deterministic fallback. |
| Business intelligence | Summarize server-calculated daily, weekly, or monthly metrics and patterns. Show source numbers alongside AI interpretations. |
| Feedback analysis | Categorize sentiment, topics, complaints, and praise. Store results separately and surface aggregated insights to admins. |
| Marketing | Draft captions, descriptions, and campaign ideas using verified business data. Support English/Sinhala and different tones. Require explicit owner approval before publishing. |
| Inventory | Track stock, ingredient use, and thresholds. Start with deterministic low-stock alerts. Evaluate forecasting after sufficient data exists and clearly label predictions. |
| Order automation | Notify customers and admins about order creation, confirmation, preparation, pickup, delivery, and completion. Respect consent and prevent duplicate messages. |

Implement these in roadmap order. The backend owns authorization, data integrity, calculations, and output validation. n8n owns orchestration. The configurable AI provider generates or classifies language using allowed input.

## Required n8n workflows

1. Order Created Notification
2. Order Status Notification
3. AI Customer Assistant
4. Product Recommendation
5. Scheduled AI Business Report
6. Customer Feedback Analysis
7. AI Marketing Content Generation
8. Low Stock Notification

Each workflow needs a trigger, authentication, input validation, processing, logging, error and retry handling, duplicate-event protection, documentation, and an example payload. Include provider calls where needed. Test in an actual n8n instance before marking the workflow verified.

## Events

Initial event names are `order.created`, `order.status_changed`, `payment.completed`, `payment.failed`, `product.created`, `product.updated`, `inventory.low_stock`, `review.created`, and `customer.registered`.

The envelope includes `eventId`, `eventType`, `schemaVersion`, `occurredAt`, `businessId`, a resource identifier, and a minimal payload. An outbox persists events durably. Signed, timestamped delivery supports retry and manual replay where appropriate. The receiver deduplicates by event ID. Track delivery status and failures without recording unnecessary customer data.

Apply provider timeouts, response validation, usage tracking, and rate limits. Retrieve products and policies from the backend and verify permission before retrieving private orders. Keep credentials server-side.
