# PayHere setup

Start with PayHere's [sandbox testing guide](https://support.payhere.lk/sandbox-and-testing) and [Checkout API](https://support.payhere.lk/api-%26-mobile-sdk/checkout-api). A sandbox merchant account has a merchant ID and a secret tied to an approved integration domain.

## Sandbox connection

1. Deploy an HTTPS storefront and expose a publicly reachable `POST /api/payments/payhere/notify` callback.
2. Configure the integration domain in the PayHere Sandbox portal. Enter the sandbox merchant ID and domain secret in the server environment.
3. Set `PAYHERE_MODE=sandbox`, `SITE_ORIGIN`, and `PAYHERE_NOTIFY_URL`. Keep `PAYHERE_LIVE_ENABLED=false`.
4. Place an online order, continue to the sandbox checkout, then confirm that the signed callback changes the recorded payment status.
5. Verify a decline and retry, then confirm that repeated callbacks leave the same settlement record and timestamp.

The backend generates the required hash for the hosted payment form. The signed callback is the source of the recorded payment result. The return page polls that record for a short period, and customers can refresh or track the order later.

## Development simulator

Set `PAYHERE_SIMULATOR=true` in the ignored server environment and run locally with a database in API mode. Choose PayHere at checkout, then use the labeled development buttons to simulate a failure or success. There is no external request or real charge. Production disables the simulator.

## Release

Live mode needs production HTTPS, the correct live integration values, and explicit `PAYHERE_LIVE_ENABLED=true`. Keep the merchant secret on the server. The provider never sends customer card data through Zestora's storefront.

To enable email, set `SMTP_URL` and `MAIL_FROM`. Shop notification preferences control the order messages. Sandbox and simulator orders do not send receipts.
