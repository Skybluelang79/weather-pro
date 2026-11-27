# WeatherPro

A premium weather dashboard built with React, TypeScript and Vite, backed by an Express-style Netlify Functions API. It combines OpenWeatherMap, Open-Meteo and RainViewer data with subscriber plans, extended forecasts, an AI assistant, custom alerts and advanced map layers.

## Features

- Current conditions, hourly and daily forecasts, air quality, NWS alerts and search history
- Saved locations, comparison view, map-based location picker and responsive theme support
- Subscriber plans: Basic (free), Pro (₦2,500/month) and Intelligence (₦5,000/month)
- 14-day and 30-day climate forecasts with hourly rainfall, wind intelligence and modeled climate data
- AI weather assistant with deterministic offline answers and optional OpenAI-compatible answers
- Custom alert rules with in-app, webhook, email, SMS and web-push delivery
- Alert inbox with unread counts plus hourly background evaluation (Intelligence checks every hour, Pro every six hours)
- Subscription management with 30-day access, renewal, cancellation and basic downgrade
- Advanced maps: RainViewer radar/satellite timelines plus OpenWeatherMap temperature, wind and air-quality layers

## Quick start

```bash
git clone https://github.com/Skybluelang79/weather-pro.git
cd weather-pro
npm install
cp .env.example .env
npm run dev
```

The Vite dev server runs on `http://localhost:5174` by default and proxies `/api` to the local API on `http://localhost:3002` unless `PORT` is changed.

## Environment variables

Copy `.env.example` to `.env` and fill in only what you need. Never commit `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENWEATHER_API_KEY` | Yes | Current weather, forecast, geocoding, air quality and map tiles |
| `PORT` | No | Local API port, default `3002` |
| `SESSION_SECRET` | Production yes | Signs the server-issued subscriber cookie; falling back to `PAYSTACK_SECRET_KEY` or a local dev secret is not suitable for production |
| `ALLOWED_ORIGIN` | No | Origin allowed to call the credentialed API; defaults to the Netlify URL or `http://localhost:5174` |
| `ALLOW_DEMO_UPGRADES` | No | Set to `true` to keep free demo upgrades available when Paystack is configured |
| `CACHE_TTL_MS` | No | Overrides all API cache TTLs in milliseconds |
| `AI_API_KEY`, `AI_API_BASE`, `AI_MODEL` | No | Optional AI assistant provider; otherwise rule-based answers |
| `PAYSTACK_SECRET_KEY` | No | Enables real Paystack checkout, verification and webhooks |
| `PAYSTACK_CALLBACK_URL` | No | Redirect after Paystack checkout, e.g. `https://your-site.netlify.app/?billing=verify` |
| `NOTIFICATION_WEBHOOK_URL` | No | Enables the webhook delivery channel for rules that select it |
| `RESEND_API_KEY`, `ALERT_EMAIL_FROM`, `ALERT_EMAIL_TO` | No | Email delivery via Resend |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `ALERT_SMS_TO` | No | SMS delivery via Twilio |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | No | Browser push delivery |

Generate web-push keys:

```bash
npx web-push generate-vapid-keys
```

Paste the public and private values into `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`. Set `VAPID_SUBJECT` to a `mailto:` address you control.

## Paystack setup

1. Create a Paystack account and copy the secret key from the dashboard.
2. Set `PAYSTACK_SECRET_KEY` locally in `.env` for local checkout.
3. Add the same key to your Netlify site environment:

```bash
netlify env:set PAYSTACK_SECRET_KEY sk_live_xxxx --site 1c5a07ef-fa98-4e7d-9bc9-832e12992b45
```

4. Set `PAYSTACK_CALLBACK_URL` to your deployed site with `?billing=verify`.
5. Add `https://your-site.netlify.app/api/billing/webhook` as a Paystack webhook URL.

Without `PAYSTACK_SECRET_KEY`, `/api/plans` reports `paymentsConfigured: false` and checkout falls back to local demo upgrades. When a Paystack key is present, `/api/subscription/demo` is disabled unless `ALLOW_DEMO_UPGRADES=true`. Each successful Paystack transaction unlocks 30 days of access; the Plans tab can renew, cancel or switch back to Basic. Checkout records are stored server-side and verified against Paystack amount, currency, plan and subscriber before activation, while the webhook remains the authoritative activation path if the browser callback is interrupted.

Subscriber identity is an HTTP-only signed cookie issued by the API; client-supplied subscriber IDs are ignored. Sign-up and sign-in are available from the header: passwords are hashed with scrypt, accounts map to a stable subscriber ID, anonymous subscriptions/favorites/history/rules migrate into the account on register or login, and the signed user cookie is cleared on logout. PRO endpoints are also enforced server-side: extended forecast (14 days), maps, AI assistant, custom alerts, multi-city comparison, full history, and unlimited favorites return `403 UPGRADE_REQUIRED` for Basic users. Premium raises the extended forecast cap to 30 days and adds climate analytics and hourly background alert checks.

## Scripts

```bash
npm run dev        # Vite dev server
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run server     # Local Express API
npm test           # Vitest test suite
npm run lint       # Oxlint
npm run typecheck  # TypeScript check
```

## API overview

| Endpoint | Purpose |
| --- | --- |
| `/api/weather/current`, `/api/weather/forecast`, `/api/weather/air`, `/api/weather/alerts` | Core weather data |
| `/api/weather/compare` | Pro-gated multi-city comparison lookup |
| `/api/geocode`, `/api/reverse-geocode` | Location search |
| `/api/favorites`, `/api/history` | Saved locations and search history |
| `/api/premium/forecast` | 14/30-day modeled forecast and hourly rain |
| `/api/maps` | RainViewer radar and satellite frame metadata |
| `/api/tiles/:layer/:z/:x/:y` | Proxied OpenWeatherMap map tiles |
| `/api/ai/weather` | AI assistant answers |
| `/api/plans`, `/api/subscription`, `/api/subscription/demo`, `/api/subscription/manage` | Plans, demo upgrades and management |
| `/api/billing/checkout`, `/api/billing/verify`, `/api/billing/webhook` | Paystack payments |
| `/api/alerts/rules`, `/api/alerts/evaluate`, `/api/alerts/notifications` | Custom alert rules, manual evaluation and inbox |
| `/api/alerts/notifications/summary`, `/api/alerts/notifications/:id/read`, `/api/alerts/notifications/read-all` | Unread count and read state |
| `/api/alerts/channels`, `/api/alerts/push-subscription` | Delivery configuration and push subscriptions |

## Alerts and delivery

Alert rules are evaluated whenever the Alerts tab loads, on demand via "Run check now", and by the hourly `scheduled-alerts` Netlify Function. Intelligence rules are checked every hour; Pro rules are checked every six hours. A rule can deliver via several channels:

- **In-app** — always available, stored in `/api/alerts/notifications` and shown in the header inbox
- **Webhook** — enabled with `NOTIFICATION_WEBHOOK_URL` and selected per rule
- **Email** — enabled with the Resend variables
- **SMS** — enabled with the Twilio variables
- **Push** — enabled with VAPID keys and browser permission; stale subscriptions are removed automatically

The service worker caches most API responses with stale-while-revalidate, but alert, subscription, billing, favorites, history, auth and plan endpoints always use the network so identity and mutations are not masked by cached data.

## Deployment

The project is configured for Netlify Functions via `netlify.toml`. Build command is `npm run build`, publish directory is `dist`, and functions live in `netlify/functions`. The `scheduled-alerts` function declares its own hourly cron schedule and only runs on published deploys; it can be invoked with "Run now" from the Netlify Functions dashboard.

For the existing deployment:

```bash
netlify deploy --prod --no-build --dir=dist --functions=netlify/functions \
  --site 1c5a07ef-fa98-4e7d-9bc9-832e12992b45 \
  --message "Your deploy message"
```

Production URL: `https://myweatherreportapp.netlify.app`

The Netlify site is currently linked to a different GitHub repository (`Weather-App`), so pushes to `weather-pro` do not auto-deploy. Either relink the site to this repository or keep using the explicit CLI deploy command above.

Before deploying, run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

## Data providers

- OpenWeatherMap — current weather, forecasts, geocoding, air quality and map layers
- Open-Meteo — extended forecast, hourly variables and prior-year climate data
- RainViewer — public radar and satellite tile metadata, no key required
- NWS — official US weather alerts
- Paystack — subscription payments
- Resend, Twilio and Web Push — alert delivery
