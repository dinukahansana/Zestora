# API documentation

## GET /api/health

Current local endpoint. Returns a liveness response when the Express process can serve requests. No authentication, request body, or query parameters are required.

~~~http
GET /api/health HTTP/1.1
Host: 127.0.0.1:3001
~~~

~~~json
{
  "status": "ok",
  "service": "zestora-api"
}
~~~

The success response is HTTP 200 with JSON content. The web starter reaches the same route through the Vite proxy. This endpoint checks Express only. Add dependency readiness checks when those dependencies are integrated.

## Planned API areas

Catalogue, categories, authentication, customer accounts, checkout, orders, payments, administrator operations, inventory, reports, automation, and AI. Document routes, request and response bodies, validation, authentication, and errors as they ship.
