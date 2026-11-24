# AI integration

Set `AI_API_BASE_URL`, `AI_MODEL`, and the provider key in the API environment to enable an OpenAI-compatible chat completions provider. The API requests structured JSON with a short timeout. The shop can disable model calls in Business settings.

The assistant and drink finder retrieve current published products before calling the model. Express verifies chosen product IDs, applies explicit ingredient exclusions, and supplies database prices and availability. Order lookups use the account session or an exact guest tracking key and stay inside Express.

Business reports keep verified metrics and model observations in separate fields. Original ratings and review text are stored separately from sentiment and topics. Marketing content is an internal draft and can be approved by an administrator. Unavailable or invalid model responses yield a labelled catalogue result, report summary, draft template, or rating-based sentiment.

The API strips recognized contact information and order identifiers from free text before model calls. The usage collection records feature, outcome, latency, and token counts when provided. Administrators can inspect its 30-day aggregates in Insights. It stores neither request text nor generated content. The business records that require review or approval store their own result fields.

The [automation specification](AI_AUTOMATION_SPECIFICATION.md) documents feature boundaries. See [n8n setup](N8N_SETUP.md) for signed orchestration.
