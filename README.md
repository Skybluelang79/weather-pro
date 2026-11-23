# WeatherPro

A premium weather dashboard built with React, TypeScript and Vite, backed by an Express-style Netlify Functions API. It combines OpenWeatherMap, Open-Meteo and RainViewer data with subscriber plans, extended forecasts, an AI assistant, custom alerts and advanced map layers.

## Features

- Current conditions, hourly and daily forecasts, air quality, NWS alerts and search history
- Saved locations, comparison view, map-based location picker and responsive theme support
- Subscriber plans: Basic (free), Pro (₦2,500/month) and Intelligence (₦5,000/month)
- 14-day and 30-day climate forecasts with hourly rainfall, wind intelligence and modeled climate data
- AI weather assistant with deterministic offline answers and optional OpenAI-compatible answers
- Custom alert rules with in-app, webhook, email, SMS and web-push delivery
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
| `CACHE_TTL_MS` | No | Overrides all API cache TTLs in milliseconds |
| `AI_API_KEY`, `AI_API_BASE`, `AI_MODEL` | No | Optional AI assistant provider; otherwise rule-based answers |
| `PAYSTACK_SECRET_KEY` | No | Enables real Paystack checkout, verification and webhooks |
| `PAYSTACK_CALLBACK_URL` | No | Redirect after Paystack checkout, e.g. `https://your-site.netlify.app/?billing=verify` |
| `NOTIFICATION_WEBHOOK_URL` | No | Forwards every triggered alert to your own bridge |
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

Without `PAYSTACK_SECRET_KEY`, `/api/plans` reports `paymentsConfigured: false` and checkout falls back to local demo upgrades.

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
| `/api/geocode`, `/api/reverse-geocode` | Location search |
| `/api/favorites`, `/api/history` | Saved locations and search history |
| `/api/premium/forecast` | 14/30-day modeled forecast and hourly rain |
| `/api/maps` | RainViewer radar and satellite frame metadata |
| `/api/tiles/:layer/:z/:x/:y` | Proxied OpenWeatherMap map tiles |
| `/api/ai/weather` | AI assistant answers |
| `/api/plans`, `/api/subscription`, `/api/subscription/demo` | Plans and demo upgrades |
| `/api/billing/checkout`, `/api/billing/verify`, `/api/billing/webhook` | Paystack payments |
| `/api/alerts/rules`, `/api/alerts/notifications` | Custom alert rules |
| `/api/alerts/channels`, `/api/alerts/push-subscription` | Delivery configuration and push subscriptions |

## Alerts and delivery

Alert rules are evaluated against live forecast data whenever the Alerts tab loads with evaluation enabled. A rule can deliver via several channels:

- **In-app** — always available, stored in `/api/alerts/notifications`
- **Webhook** — enabled with `NOTIFICATION_WEBHOOK_URL`
- **Email** — enabled with the Resend variables
- **SMS** — enabled with the Twilio variables
- **Push** — enabled with VAPID keys and browser permission; stale subscriptions are removed automatically

The service worker caches most API responses with stale-while-revalidate, but alert, subscription and billing endpoints always use the network.

## Deployment

The project is configured for Netlify Functions via `netlify.toml`. Build command is `npm run build`, publish directory is `dist`, and functions live in `netlify/functions`.

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
