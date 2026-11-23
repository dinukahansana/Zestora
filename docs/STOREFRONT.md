# Storefront

## Routes and data

React Router renders the homepage, menu, product details, About, Gallery, Contact, FAQ, and four policy previews inside the shared header and footer. `src/content/catalogue.ts` holds six demonstration items, their prices, ingredients, localized names, options, and availability. Set `VITE_CATALOGUE_MODE=api` to read published categories and products from Express and MongoDB. The query shows loading and retry states if the API is unavailable. The menu stores its search, category, and sort settings in the URL. Prices use LKR formatting.

The demo product preview calculates `(size price + add-ons) × quantity` in the browser. The checkout API calculates and validates the amount used to place an order. API mode enables the cart, pickup and delivery checkout, order tracking, and customer accounts. The gallery uses a dialog with keyboard dismissal. Product imagery is WebP and below-the-fold images load lazily.

## Localization and design

`src/locales/en.json` and `si.json` provide interface text. The language selector updates the document language and saves the choice in the browser. Product and category content has both language fields. Manrope and DM Serif Display define the English type, with Noto Sans Sinhala for Sinhala. Tailwind theme variables and shared component classes in `src/index.css` define the forest, lime, cream, spacing, and controls. Motion follows the browser's reduced-motion preference.

## Business details

The template at `apps/web/.env.example` documents optional public shop information, including hours, contact channels, and a Google Maps link. Configured details are visible in the web bundle. With a shop email set, the validated contact form opens a draft in the customer's mail app. The customer reviews and sends the email from that app. Policy pages need the owner's approved copy for a live shop.

## Image assets

Eight original photographs were generated using the built-in ImageGen tool, then encoded as WebP in `apps/web/public/images`. The prompts specified premium, photorealistic beverage photography with natural daylight and unbranded surfaces.

| Image | Brief |
| --- | --- |
| `hero.webp` | Golden mango and pink drinks, tropical fruit and mint on a dark green table in warm afternoon light. |
| `mango.webp` | Mango juice, fresh mango wedges and mint on a butter-yellow background. |
| `berry.webp` | Ruby strawberry and banana smoothie on blush stone. |
| `green.webp` | Cucumber and lime juice with mint on a warm sage surface. |
| `cocoa.webp` | Cocoa and banana milkshake with chocolate pieces on ivory stone. |
| `bowl.webp` | Diced tropical fruit and toasted coconut in a ceramic bowl. |
| `passion.webp` | Golden passionfruit and orange cooler with fresh fruit on a peach backdrop. |
| `counter.webp` | Fresh mango and citrus being prepared at a juice bar counter. |
