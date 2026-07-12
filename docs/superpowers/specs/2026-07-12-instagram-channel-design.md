# Instagram Channel — Design Spec

**Date:** 2026-07-12
**Status:** Design approved, pending implementation plan
**Scope:** MVP — connection + inbox + send text + bot reuse + handoff

## Goal

Add Instagram as a second messaging channel to SG Cloud, parallel to existing WhatsApp. Same bot, same handoff, same inbox with a channel filter. Designed to extend cleanly to TikTok / Telegram later.

## Architecture

IG is a second **channel** in a multichannel architecture. Same bot engine, same tenant config, same conversations table (with a `channel` discriminator), single inbox UI with a filter.

```
WhatsApp Cloud API ──┐
                     ├─► /webhook (router) ──► message pipeline ──► bot engine (RAG)
Instagram Graph API ─┘                              │
                                                   ▼
                                            channel-aware sender
                                                   │
                                                   ▼
                                       conversations{channel, ...}
```

### New layers

- `whatsapp-api/channels/base.py` — `ChannelAdapter` Protocol
- `whatsapp-api/channels/whatsapp.py` — refactor existing logic to subclass
- `whatsapp-api/channels/instagram.py` — OAuth exchange, send, webhook parse, token refresh
- `whatsapp-api/webhook/router.py` — single endpoint, routes by `object` field

### What does NOT change

- `conversations` table (only adds `channel`)
- Bot engine (system prompt + RAG + handoff)
- Dashboard layout (one more card)
- i18n structure

## Data model

Migration `supabase/migrations/006_instagram_channel.sql`:

```sql
-- 1. Channel discriminator on conversations
alter table conversations
  add column channel text not null default 'whatsapp'
  check (channel in ('whatsapp', 'instagram'));

alter table conversations rename column user_number to channel_user_id;

drop index if exists idx_conversations_tenant_user;
create index idx_conversations_tenant_channel
  on conversations(tenant_id, channel, last_interaction_at desc);

-- 2. IG credentials per tenant
create table tenant_instagram_credentials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade unique,
  ig_user_id text not null,
  page_id text not null,
  page_access_token text not null,
  app_secret text,
  webhook_verify_token text not null default encode(gen_random_bytes(32), 'hex'),
  status text default 'pending',
  token_expires_at timestamptz,
  raw_oauth_response jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Channel discriminator on escalations
alter table escalations
  add column channel text not null default 'whatsapp'
  check (channel in ('whatsapp', 'instagram'));

-- 4. RLS for new table
alter table tenant_instagram_credentials enable row level security;
create policy "Tenant admins see IG creds"
  on tenant_instagram_credentials for select
  using (tenant_id in (
    select tenant_id from tenant_users
    where user_id = auth.uid() and role in ('owner', 'admin')
  ));
```

### Key decisions

- `channel` is `text` with CHECK constraint (portable, easy to extend).
- One credentials table per channel — explicit, no opaque JSONB config blob.
- `channel_user_id` stores phone (WA) or IGSID (IG) depending on channel.
- Handoffs are channel-scoped.
- Backwards compatible: existing rows get `channel='whatsapp'` by default.

## Authentication UX

**Goal: one login, both channels where possible.**

Meta Embedded Signup supports a **multi-feature** config. A single popup can request both:

```js
FB.login(callback, {
  config_id: '<config with features: ["whatsapp_embedded_signup", "instagram_embedded_signup"]>',
  response_type: 'code',
  scope: 'whatsapp_business_management,whatsapp_business_messaging,instagram_basic,instagram_manage_messages,pages_show_list',
  extras: {
    feature: ['whatsapp_embedded_signup', 'instagram_embedded_signup'],
    sessionInfoListener: (info) => {
      // info.waba_id, info.phone_number_id, info.ig_user_id, info.page_id
    }
  }
});
```

**New tenant flow:** one click, one Meta authorization, both channels connected (or whatever subset the user authorized).

**Existing tenant (only WA):** second button opens the same popup with `feature: ['instagram_embedded_signup']` only.

### Token lifecycle

- Page Access Token: long-lived 60 days, **renewable indefinitely** if refreshed >24h before expiry.
- WA token: same pattern.
- Cron in Cloud Run every 24h refreshes both transparently.
- If refresh fails twice → mark `status='revoked'`, show reconnect banner.

### Meta prerequisites (user-facing)

User must have:
- Instagram Professional account
- Connected to a Facebook Page they admin

If not, Meta blocks the flow. UI shows: "Necesitas una cuenta Instagram Professional vinculada a una Página que administres."

## Frontend changes

### New / modified pages

- `src/pages/onboarding.astro` (+ `OnboardingWizard.tsx`) — step 1 becomes "Conectar canales" with single multi-feature signup button. Backend returns what was authorized.
- `src/pages/dashboard.astro` (+ `Dashboard.tsx`) — adds Instagram Connect card parallel to WhatsApp, with its own expiry alert.
- `src/pages/conversations.astro` (+ `ConversationViewer.tsx`) — filter tabs `Todos | WhatsApp | Instagram` at top of list. Each item shows a channel badge.

### New components

- `src/components/widgets/InstagramSignupButton.tsx` — Embedded Signup wrapper for IG-only flow (existing WA users).
- `src/components/widgets/ChannelBadge.tsx` — small visual badge (icon + label) for channel identification.

### i18n

All new strings in `es` + `en`, matching existing structure (translation consts inside each component).

## Backend changes

```
whatsapp-api/
├── channels/
│   ├── __init__.py            # registry + dispatcher
│   ├── base.py                # ChannelAdapter Protocol
│   ├── whatsapp.py            # refactor to subclass
│   └── instagram.py           # OAuth, send, webhook parse, refresh
├── webhook/
│   └── router.py              # single endpoint, routes by object
├── bot/
│   └── engine.py              # unchanged
└── api/
    ├── instagram/
    │   ├── exchange.py        # POST /api/instagram/exchange
    │   ├── status.py          # GET /api/instagram/status
    │   └── disconnect.py      # DELETE /api/instagram/disconnect
    └── conversations.py       # GET /api/conversations?channel=instagram
```

### ChannelAdapter protocol

```python
from typing import Protocol

class ChannelAdapter(Protocol):
    name: str

    def exchange_oauth(self, code: str, **context) -> dict: ...
    def refresh_token(self, credentials: dict) -> dict: ...
    def send_message(self, recipient_id: str, text: str, **context) -> dict: ...
    def parse_webhook(self, payload: dict) -> list[InboundMessage]: ...
```

### Webhook routing

One `/webhook` endpoint, GET (verify) and POST (receive). Routes by `entry[].id` or top-level `object`:
- `whatsapp-business-account` → `WhatsAppAdapter`
- `instagram` → `InstagramAdapter`

Meta allows multiple object types subscribed to one webhook.

### Token refresh cron

Daily Cloud Run cron (or scheduled job) iterates IG and WA credentials where `token_expires_at < now() + 7 days`, calls adapter `refresh_token`, updates row.

## Error handling

| Failure | Behavior |
|---------|----------|
| IG not professional / not linked to Page | Meta returns error, UI shows clear pre-requisite message |
| Webhook not subscribed for IG | Dashboard banner: "Configura el webhook en Meta antes de recibir mensajes" |
| Token refresh fails twice | `status='revoked'`, reconnect CTA in UI |
| Meta rate limit (200/hr per Page) | Backlog with exponential retry, alert in logs |

## Testing

- **Backend:** pytest with mock adapters for Meta, fixtures for webhooks, integration test against sandbox.
- **Frontend:** manual smoke test (matches existing WA level).
- **End-to-end:** connect IG with real account, send DM from another account, verify bot reply, trigger handoff, close handoff.

## Deployment

1. Apply migration `006_instagram_channel.sql` to Supabase.
2. Deploy backend: build, `gcloud --profile admin-test run deploy whatsapp-api`.
3. Deploy frontend: merge to main → Firebase auto-deploy.
4. **Meta Dashboard (manual, one-time):**
   - Add feature `instagram_embedded_signup` to existing config.
   - Add subscription to Page/IG in webhook config.

## Out of scope (YAGNI)

- Media attachments (images, video, audio) — v2
- Stories replies / mentions / comments — v2
- Templates IG — Meta does not provide them for IG
- TikTok / Telegram — future iterations

## Open questions for the plan

- Exact fields Meta returns in `sessionInfoListener` for IG (verify against current docs during plan)
- Backwards compat: code that joins `tenant_whatsapp_credentials` — does any code reference `user_number`? Plan must audit.
- Whether to bundle IG refresh into existing WA cron or new cron target.
