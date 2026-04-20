# Analytics — GA4 Setup & Usage Guide

## 1. Create a GA4 Property

1. Go to [analytics.google.com](https://analytics.google.com)
2. **Admin** (gear icon, bottom left) → **Create** → **Property**
3. Name it `SG Cloud`, timezone `Chile/Santiago`, currency `CLP`
4. Choose **Web** as platform
5. Enter `https://sgcloud.cl` as the website URL
6. Click **Create stream** → copy the **Measurement ID** (`G-XXXXXXXXXX`)

## 2. Add the ID to the project

Edit `src/config.yaml`:

```yaml
analytics:
  vendors:
    googleAnalytics:
      id: "G-XXXXXXXXXX"   # ← paste your Measurement ID here
```

Then rebuild and deploy:

```bash
pnpm build
firebase deploy --only hosting --project sg-cloud-cefee
```

## 3. Verify it's working

- Open `https://sgcloud.cl` in a browser
- In GA4: **Reports** → **Realtime** — you should see 1 active user within ~30 seconds

## 4. What is tracked automatically

| Event | When |
|---|---|
| `page_view` | Every page load, including View Transitions navigations |
| `contact_form_submit` | Any `<form>` submit on the site |
| `click_whatsapp` | WhatsApp CTA buttons (hero + bottom CTA) |
| `click_see_services` | "Ver servicios" scroll link in hero |
| `click_services` | "Nuestros servicios" link in bottom CTA |

## 5. Adding custom events

### In Astro components (declarative)

Add `data-ga-event` to any element — no JS needed:

```astro
<a
  href="https://wa.me/56939242145"
  data-ga-event="click_whatsapp"
  data-ga-label="pricing_page"
>
  Contáctanos
</a>
```

Available attributes:
- `data-ga-event` — event name (required)
- `data-ga-label` — label to identify where on the page (optional)
- `data-ga-category` — category grouping (optional)

### In Preact/React components (programmatic)

```typescript
import { trackEvent } from '~/utils/analytics';

// Simple click
trackEvent('click_whatsapp', { label: 'conversations_page' });

// With a value
trackEvent('handoff_initiated', { label: 'cubrejardin', value: 1 });
```

## 6. Key reports to watch in GA4

### Traffic overview
**Reports** → **Acquisition** → **Traffic acquisition**
- Shows where visitors come from (organic search, direct, referral, social)

### Page engagement
**Reports** → **Engagement** → **Pages and screens**
- Which pages get the most views and time on page
- High bounce on `/services` = content isn't converting

### Events
**Reports** → **Engagement** → **Events**
- See all tracked events with counts
- `click_whatsapp` count = lead intent signal
- `contact_form_submit` = direct lead conversions

### Conversions (set up recommended)
**Admin** → **Events** → mark `contact_form_submit` and `click_whatsapp` as **conversions**
Then use **Reports** → **Acquisition** → **Traffic acquisition** filtered to conversions to know which channels drive leads.

### Realtime
**Reports** → **Realtime** — useful for testing after deploys

## 7. Linking to Google Search Console (recommended)

1. Go to [search.google.com/search-console](https://search.google.com/search-console)
2. Add property for `https://sgcloud.cl` and verify via DNS TXT record
3. In GA4: **Admin** → **Product Links** → **Search Console** → link the property
4. Unlocks **Queries** report: which Google searches bring people to the site

## 8. Useful GA4 explorations

Go to **Explore** in the left nav to build custom reports:

- **Funnel**: `page_view /` → `page_view /services` → `click_whatsapp` — measures homepage-to-lead funnel
- **Path exploration**: see what pages users visit before contacting
- **Cohort**: track if visitors from a campaign return
