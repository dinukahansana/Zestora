# Database schema

Zestora uses MongoDB and Mongoose. Mongoose describes document fields and indexes and turns database records into JavaScript objects. A production or demo deployment can connect to MongoDB Atlas through its server-side connection string. Local integration tests launch a temporary real MongoDB replica set.

## Implemented collections

| Collection | Key fields and indexes |
| --- | --- |
| `users` | Name, normalized unique email, password hash, role, timestamps. The hash is excluded from ordinary queries. |
| `sessions` | Indexed user reference, unique token hash, expiry date, and timestamps. MongoDB has a TTL index for cleanup. Session reads also check expiry immediately. |
| `categories` | Unique slug, English/Sinhala name, position, publication flag, timestamps. |
| `products` | Unique slug, category slug, bilingual fields, image URL, publication, demo and availability flags, sizes, add-ons, starting price, and timestamps. The search index covers publication, category, and starting price. |

Products link to categories with a stable slug. The public API filters out unpublished categories and their products. Prices are whole LKR in this schema. Demo seeding inserts absent slugs and keeps existing documents. The catalogue writer validates choices and calculates starting price from the cheapest size.

## Planned collections

Customer addresses, orders, payments, discounts, delivery and business settings, inventory, reviews, notifications, automation events, and AI outputs are introduced with their features. Order items will preserve accepted choices and prices independently of later catalogue changes. Order and payment status will be tracked separately.

## Ordering collections

| Collection | Key fields and indexes |
| --- | --- |
| `orders` | Unique public reference and checkout key, buyer and fulfilment details, optional account owner, hashed guest key, immutable product and price snapshots, total breakdown, and separate order and payment status. |
| `shops` | Unique shop key, enabled fulfilment modes, localized delivery zones with fees, and minimum shopping subtotal. |
| `coupons` | Unique normalized code, percentage or fixed value, minimum order, enabled flag, expiry and usage limit, and number redeemed. |

Saved addresses and the current hashed password-reset key live on the user document. The order and coupon counter commit in the same transaction. Use Atlas or another MongoDB replica set for ordering and password reset transactions.

## Administration collections and reporting

`stocks` stores a unique item slug, bilingual name, unit, current quantity, and low-stock threshold. `auditlogs` records the actor's user ID, action, entity, reference, and commit timestamp. Administrative database mutations and their audit entry commit together. The shop record also stores public branding and contact fields and switches for notification and AI workflows.

Order fulfilment and payment state stay distinct. A cash payment records `paidAt`. Reports group active paid transactions in the Asia/Colombo time zone. Listing an item in an order snapshots its previous price, so catalogue editing preserves historical totals.
