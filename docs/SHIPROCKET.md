# Shiprocket integration

End-to-end courier integration built on the **Shiprocket External API**
(`https://apiv2.shiprocket.in/v1/external`). It is **inert until configured** —
with no `SHIPROCKET_EMAIL` / `SHIPROCKET_PASSWORD` the store behaves exactly as
before (manual fulfilment).

## What it does

| Step | Trigger | Endpoint(s) used |
|------|---------|------------------|
| Authenticate | lazy, cached ~9 days (memory + `Integration` table), auto-refresh on 401 | `POST /auth/login` |
| Serviceability | admin "Check couriers" | `GET /courier/serviceability/` |
| Create order + shipment | order confirmed (auto) or admin "Create shipment" | `POST /orders/create/adhoc` |
| Assign AWB | auto after create (recommended courier) or admin | `POST /courier/assign/awb` |
| Schedule pickup | admin "Schedule pickup" | `POST /courier/generate/pickup` |
| Label / Invoice / Manifest | admin buttons | `POST /courier/generate/label`, `/orders/print/invoice`, `/manifests/generate` |
| Tracking sync | Shiprocket webhook + 45-min poll + admin "Refresh" | `GET /courier/track/shipment/{id}` |
| Cancel | admin "Cancel shipment" | `POST /orders/cancel/shipment/awbs`, `POST /orders/cancel` |

Order status is advanced **forward-only** from shipment events:
`CONFIRMED → PROCESSING → PACKED → SHIPPED → OUT_FOR_DELIVERY → DELIVERED`
(`RETURNED` on RTO). The finer courier status (`In transit`, `Ready to ship`, …)
is shown from `Shipment.status` / `Shipment.rawStatus`.

## Environment variables (API service only)

| Var | Required | Purpose |
|-----|----------|---------|
| `SHIPROCKET_EMAIL` | yes | Shiprocket **API user** email (Settings → API → Configure) |
| `SHIPROCKET_PASSWORD` | yes | API-user password (**not** the main login) |
| `SHIPROCKET_PICKUP_LOCATION` | recommended | exact nickname of a *verified* pickup address; first one on the account if unset |
| `SHIPROCKET_WEBHOOK_TOKEN` | for webhook | random secret; also pasted into Shiprocket's webhook config (`x-api-key`) |
| `SHIPROCKET_CHANNEL_ID` | optional | pin created orders to one Shiprocket channel |
| `SHIPROCKET_BASE_URL` | optional | default `https://apiv2.shiprocket.in/v1/external` |
| `SHIPROCKET_AUTO_CREATE` | optional | default `true` — push confirmed orders automatically |
| `SHIPROCKET_AUTO_ASSIGN_AWB` | optional | default `true` |
| `SHIPROCKET_DEFAULT_WEIGHT_KG` / `_LENGTH_CM` / `_BREADTH_CM` / `_HEIGHT_CM` | optional | parcel fallback when a product has no weight |

Never put these in frontend env or Git. They are `sync: false` in `render.yaml`.

## Webhook

Shiprocket panel → **Settings → API → Webhooks**:

- URL: `https://slay-jeans-api.onrender.com/api/v1/webhooks/shipping/shiprocket`
- Token / `x-api-key`: the value of `SHIPROCKET_WEBHOOK_TOKEN`

The endpoint always returns `200`; the body reports `handled: true|false`.
Requests without a matching `x-api-key` are ignored.

## Admin

Order detail page → **Shipment & fulfilment** card:
Check couriers · Create shipment · Generate AWB · Schedule pickup ·
Download label · Invoice · Refresh tracking · Open tracking · Cancel shipment,
plus the full scan history.

## Customer

`My Account → Orders → Track Order` (`/order/<number>`): progress tracker plus a
**Shipment** block with courier, AWB, ETA, a "Track with courier" link and the
scan history.

## Data model

Additive nullable columns on `Shipment` (migration
`20260903120000_shiprocket_shipping`): `rawStatus`, `invoiceUrl`, `cancelledAt`,
`providerOrderId`, `providerShipmentId`, `courierId`, `pickupLocation`,
`pickupScheduledAt`, `pickupTokenNumber`, `freightCharge`, `appliedWeightGrams`,
`lastSyncedAt`. No enum changes. `Integration(provider='shiprocket')` caches the
auth token.

## Code map

```
apps/api/src/shipping/
  shiprocket.types.ts          typed API contracts
  shiprocket.service.ts        low-level client: auth cache, retry, 401 re-auth, logging
  status-map.ts                Shiprocket status → ShipmentStatus / OrderStatus
  shipping.service.ts          orchestration + DB sync + webhook + 45-min poll
  shipping.controller.ts       /api/v1/admin/* (order:read / order:update)
  shipping-webhook.controller.ts   /api/v1/webhooks/shipping/shiprocket (public, token-verified)
  shipping.module.ts
apps/api/src/orders/orders.service.ts   finalizePayment() → shipping.autoCreateForOrder()
```
