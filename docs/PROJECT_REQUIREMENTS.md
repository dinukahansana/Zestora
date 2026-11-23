# Project requirements

## Storefront and ordering

| Area | Requirements |
| --- | --- |
| Home | Responsive navigation, hero, brand introduction, featured and popular products, categories, promotions, gallery, contact information, calls to action, and clearly marked demonstration testimonials. |
| Menu | Fresh Fruit Juices, Smoothies, Milkshakes, Detox Drinks, Fresh Fruit Bowls, and Seasonal Specials. Support search, filtering, sorting, LKR pricing, featured items, and availability. |
| Product details | Show photos, descriptions, ingredients, category, sizes, size-based prices, add-ons, availability, quantity, and related items. Validate options and price on the server. |
| Cart | Add, update, and remove items. Preserve cart state appropriately, apply coupons, and calculate line items, delivery charges, and totals on the backend. |
| Checkout | Guest and registered checkout with contact details, delivery address and instructions where applicable, pickup, preferred time, special instructions, coupon validation, and a server-calculated summary. Support home delivery, shop pickup, cash on delivery, cash on pickup, and PayHere. |
| Tracking | Return a unique order reference, status, payment status, and fulfilment details. Require secure verification for guest tracking and authorization for account orders. |
| Accounts | Registration, login/logout, password reset, profile, saved addresses, order history, and reorder. Decide session details during authentication design. |
| Pages | About, Gallery, Contact, FAQ, Privacy Policy, Terms and Conditions, Refund Policy, and Cancellation Policy. Contact supports hours, address, phone, email, Google Maps, WhatsApp, social links, and a form. Business policies are configurable and need owner-approved content. |

Build mobile, tablet, and desktop layouts. Use translation resources for English and Sinhala navigation, controls, forms, validation, dashboard text, status labels, and notifications. Support bilingual product and business content where needed and bilingual AI responses where supported. Define shared colors, type, buttons, cards, navigation, forms, dialogs, tables, and loading, empty, and error states. Use Lucide icons and selective Framer Motion.

## Administration

- Secure an admin area with role-based access. Show real sales, orders, customers, popular products, recent orders, and low-stock data once connected.
- Provide product and category management with images, sizes, add-ons, ingredients, price and availability controls, and featured product settings.
- Let administrators search and filter orders, view and print details, confirm cash payments, and manage order transitions separately from payment status.
- Let permitted administrators search customers and view relevant order history. Support coupons with dates, discount type, usage limits, minimum order, and active status.
- Configure branding, location, contact information, opening hours, delivery zones and fees, pickup, minimum order, social links, currency, languages, notifications, and AI settings.
- Report daily, weekly, and monthly sales, order statistics, product popularity, and revenue using database-calculated figures.

Order states include Pending, Confirmed, Preparing, Ready for Pickup, Out for Delivery, Completed, and Cancelled. Payment states include Pending, Paid, Failed, and Refunded. The backend will enforce permitted transitions.

## Integrations and reliability

- Use Cloudinary for uploaded images and MongoDB Atlas for structured data.
- Start PayHere in sandbox. The backend initiates payments, verifies notifications, and handles duplicates. A development simulator, if needed, must be clearly labeled.
- Keep core ordering available if automation or AI is down. Use verified business data for AI answers and validate AI output before it is used in business flows.
- Support order notifications, product recommendations, business summaries, review analysis, marketing drafts, and stock alerts. See the [AI and automation specification](AI_AUTOMATION_SPECIFICATION.md).
- Protect customer information, credentials, payments, webhooks, and administrative functions. See [security](SECURITY.md).

## Milestone order

Phase 0 sets up the repository. Phases 1–4 cover the storefront and design system, API and database, ordering, and administration. Phases 5–8 cover payments and notifications, the automation foundation, AI features, and advanced automation. Phase 9 verifies security, performance, accessibility and responsiveness, integrations, and deployment.
