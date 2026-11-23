# Database schema

MongoDB Atlas and Mongoose are planned for the backend and database milestone. Phase 0 has no database connection or persisted records. The model groups below describe the intended scope and will be refined with each feature.

| Model group | Planned records |
| --- | --- |
| Identity | Users, customer profiles where needed, and saved addresses |
| Catalogue | Products, categories, reviews, and media references |
| Commerce | Orders, payments, coupons, and delivery details |
| Operations | Business settings, inventory items, notifications, and automation events |
| AI outputs | Business reports, feedback analyses, marketing drafts, and conversation records only where retention is necessary |

Products will reference categories and identify size and add-on choices. Order items should preserve the accepted product selections and prices so catalogue edits do not rewrite order history. Persist separate order and payment states and retain their association. Keep generated AI analyses linked to their source records without altering them.

Choose unique constraints and query indexes with the actual access patterns. Likely candidates are public order references, payment provider identifiers, and outbox event IDs. Document exact fields, relationships, indexes, and migration or seed steps when each model is added.
