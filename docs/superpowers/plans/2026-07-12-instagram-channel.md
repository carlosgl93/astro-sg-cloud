# Instagram Channel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Instagram as a second messaging channel in SG Cloud, sharing the bot engine and inbox with WhatsApp.

**Architecture:** Channel adapter pattern. `InstagramAdapter` mirrors the existing `WhatsappService` interface. A registry routes OAuth, webhooks, and outbound sends by channel. Conversations and handoffs get a `channel` discriminator. Frontend adds IG signup, dashboard card, and inbox filter.

**Tech Stack:**
- Backend: FastAPI (Python), Supabase (Postgres), Meta Graph API
- Frontend: Astro + Preact + Supabase JS
- Deploy: Cloud Run + Firebase Hosting

**Spec:** `docs/superpowers/specs/2026-07-12-instagram-channel-design.md`

**Repos touched:**
- `cubrejardin-bot/` — FastAPI backend
- `astro-sg-cloud/` — Astro frontend
- `cubrejardin-bot/sql/migrations/` — Supabase migrations (apply via Supabase SQL editor or `supabase db push`)


---

## Phase A — Data layer

### Task A.1: Migration to add `channel` discriminator

**Files:**
- Create: `cubrejardin-bot/sql/migrations/006_instagram_channel.sql`
- Modify: `cubrejardin-bot/services/whatsapp_service.py` (if it joins on `user_number`)
- Modify: `cubrejardin-bot/api/handoffs.py` (if it filters `user_number`)

> **Note:** this migration renames `user_number` → `channel_user_id`. The blast radius is contained (audit in Step 2) and yields cleaner typing in the long run.

- [ ] **Step 1: Write the migration**

```sql
-- 006_instagram_channel.sql
-- Adds channel discriminator to conversations + handoffs,
-- and the tenant_instagram_credentials table.

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'instagram'));

ALTER TABLE handoffs
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'whatsapp'
  CHECK (channel IN ('whatsapp', 'instagram'));

-- Rename user_number -> channel_user_id for semantic clarity.
-- This is a structural cleanup that does not change row data.
ALTER TABLE conversations RENAME COLUMN user_number TO channel_user_id;
ALTER TABLE handoffs RENAME COLUMN user_number TO channel_user_id;

CREATE TABLE IF NOT EXISTS tenant_instagram_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id) ON DELETE CASCADE,
  ig_user_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  app_secret TEXT,
  webhook_verify_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'revoked')),
  token_expires_at TIMESTAMPTZ,
  raw_oauth_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_instagram_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins see IG creds"
  ON tenant_instagram_credentials FOR SELECT
  USING (tenant_id IN (
    SELECT tenant_id FROM tenant_users
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_channel_recent
  ON conversations (tenant_id, channel, created_at DESC);
```

- [ ] **Step 2: Audit codebase for `user_number` queries that must filter by channel**

```bash
cd cubrejardin-bot
grep -rn "user_number" api/ services/ agents/ | grep -v "__pycache__"
```

Open each hit. If a query touches WA-specific logic (e.g., dispatches to `WhatsappService.send`), it must add `channel = 'whatsapp'` to the filter, OR explicitly ignore channel when channel-agnostic. Document hits as inline comments before continuing.

- [ ] **Step 3: Apply the migration**

Apply via Supabase SQL editor. Verify no errors. Run:

```sql
\d conversations
\d handoffs
\d tenant_instagram_credentials
```

Expected: columns appear with correct types and constraints.

- [ ] **Step 4: Commit**

```bash
cd cubrejardin-bot
git add sql/migrations/006_instagram_channel.sql
git commit -m "feat(db): add channel discriminator + instagram credentials table"
```


---

## Phase B — Backend: channel adapter pattern

### Task B.1: Define ChannelAdapter protocol

**Files:**
- Create: `cubrejardin-bot/channels/__init__.py`
- Create: `cubrejardin-bot/channels/base.py`
- Create: `cubrejardin-bot/tests/test_channel_base.py`

- [ ] **Step 1: Write failing test for adapter contract**

`cubrejardin-bot/tests/test_channel_base.py`:

```python
from channels.base import ChannelAdapter, InboundMessage


def test_inbound_message_dataclass():
    msg = InboundMessage(
        channel="instagram",
        external_user_id="IGSID_123",
        text="hola",
        raw={"entry": []},
    )
    assert msg.channel == "instagram"
    assert msg.external_user_id == "IGSID_123"
    assert msg.text == "hola"


def test_adapter_protocol_is_runtime_checkable():
    class FakeAdapter:
        name = "fake"

        def exchange_oauth(self, code, **ctx): return {"access_token": "x"}
        def refresh_token(self, credentials): return {"access_token": "y"}
        def send_message(self, recipient_id, text, **ctx): return {"message_id": "m1"}
        def parse_webhook(self, payload): return []

    assert isinstance(FakeAdapter(), ChannelAdapter)
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cubrejardin-bot
pytest tests/test_channel_base.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'channels'`.

- [ ] **Step 3: Implement base + dataclass**

`cubrejardin-bot/channels/__init__.py`:

```python
from channels.base import ChannelAdapter, InboundMessage
from channels.registry import get_adapter, register_adapter

__all__ = ["ChannelAdapter", "InboundMessage", "get_adapter", "register_adapter"]
```

`cubrejardin-bot/channels/base.py`:

```python
from dataclasses import dataclass, field
from typing import Any, Protocol, runtime_checkable


@dataclass
class InboundMessage:
    channel: str           # 'whatsapp' | 'instagram'
    external_user_id: str  # phone number or IGSID
    text: str
    raw: dict = field(default_factory=dict)
    metadata: dict = field(default_factory=dict)


@runtime_checkable
class ChannelAdapter(Protocol):
    name: str

    def exchange_oauth(self, code: str, **context: Any) -> dict:
        """Exchange OAuth `code` (from Meta) into channel credentials."""
        ...

    def refresh_token(self, credentials: dict) -> dict:
        """Refresh an expiring access token. Returns updated credentials."""
        ...

    def send_message(self, recipient_id: str, text: str, **context: Any) -> dict:
        """Send a text reply. Returns provider message id."""
        ...

    def parse_webhook(self, payload: dict) -> list[InboundMessage]:
        """Parse a webhook payload into a list of inbound messages."""
        ...
```

`cubrejardin-bot/channels/registry.py`:

```python
from channels.base import ChannelAdapter

_registry: dict[str, ChannelAdapter] = {}


def register_adapter(adapter: ChannelAdapter) -> None:
    _registry[adapter.name] = adapter


def get_adapter(name: str) -> ChannelAdapter:
    if name not in _registry:
        raise KeyError(f"No adapter registered for channel '{name}'")
    return _registry[name]


def known_channels() -> list[str]:
    return list(_registry.keys())
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cubrejardin-bot
pytest tests/test_channel_base.py -v
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd cubrejardin-bot
git add channels/ tests/test_channel_base.py
git commit -m "feat(channels): add ChannelAdapter protocol + registry"
```


---

### Task B.2: Wrap WhatsApp service as adapter

**Files:**
- Create: `cubrejardin-bot/channels/whatsapp.py`
- Modify: `cubrejardin-bot/main.py` (register the adapter at startup)
- Create: `cubrejardin-bot/tests/test_whatsapp_adapter.py`

- [ ] **Step 1: Write failing test**

`cubrejardin-bot/tests/test_whatsapp_adapter.py`:

```python
from unittest.mock import patch, MagicMock

from channels.whatsapp import WhatsAppAdapter


def test_whatsapp_adapter_name():
    assert WhatsAppAdapter().name == "whatsapp"


def test_whatsapp_adapter_parse_webhook_yields_messages():
    adapter = WhatsAppAdapter()
    payload = {
        "entry": [{
            "id": "WABA_ID",
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "56912345678",
                        "text": {"body": "hola"},
                        "id": "wamid.ABC",
                    }],
                    "metadata": {"phone_number_id": "PHONE_ID"},
                },
                "field": "messages",
            }],
        }]
    }
    msgs = adapter.parse_webhook(payload)
    assert len(msgs) == 1
    assert msgs[0].channel == "whatsapp"
    assert msgs[0].external_user_id == "56912345678"
    assert msgs[0].text == "hola"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cubrejardin-bot
pytest tests/test_whatsapp_adapter.py -v
```

Expected: FAIL with `ModuleNotFoundError: No module named 'channels.whatsapp'`.

- [ ] **Step 3: Implement the WhatsApp adapter**

`cubrejardin-bot/channels/whatsapp.py`:

```python
from channels.base import ChannelAdapter, InboundMessage


class WhatsAppAdapter(ChannelAdapter):
    name = "whatsapp"

    def exchange_oauth(self, code: str, **context) -> dict:
        from services.facebook_auth import exchange_code  # existing
        return exchange_code(code, **context)

    def refresh_token(self, credentials: dict) -> dict:
        from services.whatsapp_service import refresh_long_lived_token
        return refresh_long_lived_token(credentials)

    def send_message(self, recipient_id: str, text: str, **context) -> dict:
        from services.whatsapp_service import send_text_message
        return send_text_message(
            recipient_id=recipient_id,
            text=text,
            tenant_id=context["tenant_id"],
        )

    def parse_webhook(self, payload: dict) -> list[InboundMessage]:
        out: list[InboundMessage] = []
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                if change.get("field") != "messages":
                    continue
                value = change.get("value", {})
                metadata = value.get("metadata", {})
                for msg in value.get("messages", []):
                    if msg.get("type") != "text":
                        continue
                    out.append(InboundMessage(
                        channel="whatsapp",
                        external_user_id=msg["from"],
                        text=msg["text"]["body"],
                        raw=msg,
                        metadata={
                            "phone_number_id": metadata.get("phone_number_id"),
                            "waba_id": metadata.get("waba_id"),
                            "wamid": msg.get("id"),
                        },
                    ))
        return out
```

`cubrejardin-bot/main.py` — locate the FastAPI `app = FastAPI()` line and add after it:

```python
from channels.whatsapp import WhatsAppAdapter
from channels.instagram import InstagramAdapter  # noqa: F401  (added in B.3)
from channels.registry import register_adapter

register_adapter(WhatsAppAdapter())
register_adapter(InstagramAdapter())
```

If the existing code does not import `register_adapter` at startup yet, place the calls in the `startup` event or at module import time at the bottom of `main.py`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cubrejardin-bot
pytest tests/test_whatsapp_adapter.py -v
```

Expected: PASS (2 tests).

- [ ] **Step 5: Smoke-test that webhook still works**

Run the existing webhook test:

```bash
cd cubrejardin-bot
pytest tests/test_webhook.py -v
```

Expected: PASS. (No regression — the adapter wraps existing service calls.)

- [ ] **Step 6: Commit**

```bash
cd cubrejardin-bot
git add channels/whatsapp.py main.py tests/test_whatsapp_adapter.py
git commit -m "feat(channels): wrap whatsapp service as ChannelAdapter"
```


---

### Task B.3: InstagramAdapter skeleton (no real API yet)

**Files:**
- Create: `cubrejardin-bot/channels/instagram.py`
- Create: `cubrejardin-bot/tests/test_instagram_adapter.py`

- [ ] **Step 1: Write failing test for IG webhook parsing**

`cubrejardin-bot/tests/test_instagram_adapter.py`:

```python
from channels.instagram import InstagramAdapter


def test_instagram_adapter_name():
    assert InstagramAdapter().name == "instagram"


def test_instagram_parse_webhook_text_message():
    adapter = InstagramAdapter()
    payload = {
        "entry": [{
            "id": "PAGE_ID_123",
            "messaging": [{
                "sender": {"id": "IGSID_USER_456"},
                "recipient": {"id": "IGSID_PAGE_789"},
                "message": {
                    "mid": "m_abc",
                    "text": "hola desde IG",
                },
            }],
        }]
    }
    msgs = adapter.parse_webhook(payload)
    assert len(msgs) == 1
    assert msgs[0].channel == "instagram"
    assert msgs[0].external_user_id == "IGSID_USER_456"
    assert msgs[0].text == "hola desde IG"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_adapter.py -v
```

Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement InstagramAdapter parse_webhook (other methods stubbed)**

`cubrejardin-bot/channels/instagram.py`:

```python
import os
import httpx

from channels.base import ChannelAdapter, InboundMessage


GRAPH_API_VERSION = os.getenv("META_GRAPH_VERSION", "v21.0")
GRAPH_BASE = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class InstagramAdapter(ChannelAdapter):
    name = "instagram"

    def exchange_oauth(self, code: str, **context) -> dict:
        """Exchange Meta OAuth code for IG credentials.
        Implemented in Task C.1."""
        raise NotImplementedError("Implemented in C.1")

    def refresh_token(self, credentials: dict) -> dict:
        """Implemented in Task C.3 — refresh long-lived Page token."""
        raise NotImplementedError("Implemented in C.3")

    def send_message(self, recipient_id: str, text: str, **context) -> dict:
        """Implemented in Task F.1 — POST to /me/messages."""
        raise NotImplementedError("Implemented in F.1")

    def parse_webhook(self, payload: dict) -> list[InboundMessage]:
        out: list[InboundMessage] = []
        for entry in payload.get("entry", []):
            page_id = entry.get("id")
            for event in entry.get("messaging", []):
                msg = event.get("message") or {}
                text = msg.get("text")
                if not text:
                    continue
                sender = event.get("sender", {}).get("id")
                if not sender:
                    continue
                out.append(InboundMessage(
                    channel="instagram",
                    external_user_id=sender,
                    text=text,
                    raw=msg,
                    metadata={
                        "page_id": page_id,
                        "ig_mid": msg.get("mid"),
                    },
                ))
        return out
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_adapter.py -v
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
cd cubrejardin-bot
git add channels/instagram.py tests/test_instagram_adapter.py
git commit -m "feat(channels): InstagramAdapter skeleton with webhook parsing"
```


---

## Phase C — Backend: Instagram OAuth

### Task C.1: OAuth exchange endpoint

**Files:**
- Create: `cubrejardin-bot/api/instagram.py`
- Create: `cubrejardin-bot/tests/test_instagram_exchange.py`

- [ ] **Step 1: Write failing test**

`cubrejardin-bot/tests/test_instagram_exchange.py`:

```python
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_exchange_endpoint_persists_credentials():
    fake_exchange_result = {
        "access_token": "PAGE_TOKEN_LONG",
        "expires_in": 5184000,  # 60 days
        "ig_user_id": "17841401234567890",
        "page_id": "1234567890",
    }

    with patch("api.instagram._graph_post", return_value=fake_exchange_result), \
         patch("api.instagram._supabase_upsert_ig_creds") as upsert, \
         patch("api.instagram._resolve_tenant", return_value="TENANT_UUID"):
        resp = client.post(
            "/api/instagram/exchange",
            json={"auth_code": "AUTH_CODE_XYZ", "redirect_uri": "https://app/cb"},
            headers={"Authorization": "Bearer FAKE_JWT"},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["ig_user_id"] == "17841401234567890"
    assert body["status"] == "active"
    upsert.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_exchange.py -v
```

Expected: FAIL with `404` or `ModuleNotFoundError`.

- [ ] **Step 3: Implement endpoint**

`cubrejardin-bot/api/instagram.py`:

```python
import os
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from fastapi import APIRouter, Depends, HTTPException

from api.dependencies import get_current_tenant  # existing
from channels.instagram import GRAPH_BASE

router = APIRouter(prefix="/api/instagram", tags=["instagram"])


def _graph_post(path: str, params: dict) -> dict[str, Any]:
    """POST helper against Graph API. Wrapped for tests."""
    resp = httpx.post(f"{GRAPH_BASE}{path}", params=params, timeout=15)
    resp.raise_for_status()
    return resp.json()


def _resolve_tenant(token: str) -> str:
    """Mockable indirection — real impl in api/tenant_context.py"""
    from api.tenant_context import resolve_tenant_id_from_token
    return resolve_tenant_id_from_token(token)


def _supabase_upsert_ig_creds(tenant_id: str, row: dict) -> None:
    """Mockable indirection — real impl writes via supabase client."""
    from config.supabase import get_supabase_admin
    supabase = get_supabase_admin()
    supabase.table("tenant_instagram_credentials").upsert(
        {"tenant_id": tenant_id, **row},
        on_conflict="tenant_id",
    ).execute()


@router.post("/exchange")
def exchange(
    payload: dict,
    tenant_id: str = Depends(get_current_tenant),
):
    code = payload.get("auth_code")
    redirect_uri = payload.get("redirect_uri", "")
    if not code:
        raise HTTPException(status_code=400, detail="auth_code required")

    app_id = os.environ["FACEBOOK_APP_ID"]
    app_secret = os.environ["FACEBOOK_APP_SECRET"]

    # 1. Exchange code → short-lived user token
    token_resp = _graph_post("/oauth/access_token", {
        "client_id": app_id,
        "client_secret": app_secret,
        "code": code,
        "redirect_uri": redirect_uri,
    })
    short_token = token_resp["access_token"]

    # 2. Exchange short → long-lived (~60 days)
    long_resp = _graph_post("/oauth/access_token", {
        "grant_type": "fb_exchange_token",
        "client_id": app_id,
        "client_secret": app_secret,
        "fb_exchange_token": short_token,
    })
    long_token = long_resp["access_token"]
    expires_in = long_resp.get("expires_in", 5184000)

    # 3. Resolve IG user + page
    me_resp = _graph_post("/me/accounts", {"access_token": long_token})
    pages = me_resp.get("data") or []
    if not pages:
        raise HTTPException(status_code=400, detail="No Facebook Pages found for this account")
    page = pages[0]
    page_id = page["id"]
    page_access_token = page["access_token"]

    # 4. Find the linked Instagram account
    ig_user_id = None
    for p in pages:
        r = _graph_post(f"/{p['id']}", {
            "fields": "instagram_business_account",
            "access_token": long_token,
        })
        igba = r.get("instagram_business_account")
        if igba:
            ig_user_id = igba["id"]
            page_id = p["id"]
            page_access_token = p["access_token"]
            break

    if not ig_user_id:
        raise HTTPException(
            status_code=400,
            detail="No Instagram Professional account linked to your Pages",
        )

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
    row = {
        "ig_user_id": ig_user_id,
        "page_id": page_id,
        "page_access_token": page_access_token,
        "app_secret": app_secret,
        "status": "active",
        "token_expires_at": expires_at.isoformat(),
        "raw_oauth_response": {
            "short_token_resp": token_resp,
            "long_token_resp": long_resp,
            "page_id": page_id,
        },
    }
    _supabase_upsert_ig_creds(tenant_id, row)

    return {
        "ig_user_id": ig_user_id,
        "page_id": page_id,
        "status": "active",
        "token_expires_at": row["token_expires_at"],
    }
```

Wire it into the app. In `cubrejardin-bot/main.py`, locate the existing `app.include_router(...)` calls and add:

```python
from api.instagram import router as instagram_router
app.include_router(instagram_router)
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_exchange.py -v
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd cubrejardin-bot
git add api/instagram.py main.py tests/test_instagram_exchange.py
git commit -m "feat(api): POST /api/instagram/exchange — OAuth flow"
```


---

### Task C.2: Status endpoint

**Files:**
- Create: `cubrejardin-bot/api/instagram.py` (extend)

- [ ] **Step 1: Write failing test**

Append to `cubrejardin-bot/tests/test_instagram_exchange.py`:

```python
def test_status_endpoint_returns_state():
    with patch("api.instagram._supabase_fetch_ig_creds", return_value={
        "status": "active",
        "ig_user_id": "17841401234567890",
        "page_id": "1234567890",
        "token_expires_at": "2026-09-10T00:00:00+00:00",
    }):
        resp = client.get("/api/instagram/status",
                          headers={"Authorization": "Bearer FAKE_JWT"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["instagram_connected"] is True
    assert body["status"] == "active"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_exchange.py::test_status_endpoint_returns_state -v
```

Expected: FAIL with 404.

- [ ] **Step 3: Add handler**

In `cubrejardin-bot/api/instagram.py`, append:

```python
@router.get("/status")
def status(tenant_id: str = Depends(get_current_tenant)):
    row = _supabase_fetch_ig_creds(tenant_id)
    if not row:
        return {"instagram_connected": False, "status": "absent"}
    return {
        "instagram_connected": row.get("status") == "active",
        "status": row.get("status"),
        "ig_user_id": row.get("ig_user_id"),
        "page_id": row.get("page_id"),
        "token_expires_at": row.get("token_expires_at"),
    }


def _supabase_fetch_ig_creds(tenant_id: str) -> dict | None:
    from config.supabase import get_supabase_admin
    supabase = get_supabase_admin()
    res = (
        supabase.table("tenant_instagram_credentials")
        .select("*")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return res.data
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_exchange.py -v
```

Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
cd cubrejardin-bot
git add api/instagram.py tests/test_instagram_exchange.py
git commit -m "feat(api): GET /api/instagram/status"
```


---

### Task C.3: Token refresh job

**Files:**
- Create: `cubrejardin-bot/jobs/refresh_instagram_tokens.py`
- Create: `cubrejardin-bot/tests/test_instagram_token_refresh.py`

- [ ] **Step 1: Write failing test**

`cubrejardin-bot/tests/test_instagram_token_refresh.py`:

```python
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from jobs.refresh_instagram_tokens import refresh_due_tokens


def test_refresh_updates_expiring_tokens():
    expires_soon = (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()
    fake_creds = [{
        "tenant_id": "T_1",
        "page_access_token": "OLD_TOKEN",
        "token_expires_at": expires_soon,
    }]
    with patch("jobs.refresh_instagram_tokens._fetch_due_creds", return_value=fake_creds), \
         patch("jobs.refresh_instagram_tokens._refresh_token", return_value={
             "page_access_token": "NEW_TOKEN",
             "expires_in": 5184000,
         }), \
         patch("jobs.refresh_instagram_tokens._update_creds") as update:
        refresh_due_tokens()
    update.assert_called_once()
    args, kwargs = update.call_args
    assert kwargs["page_access_token"] == "NEW_TOKEN"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_token_refresh.py -v
```

Expected: FAIL with `ModuleNotFoundError`.

- [ ] **Step 3: Implement refresh logic**

`cubrejardin-bot/jobs/refresh_instagram_tokens.py`:

```python
import os
from datetime import datetime, timedelta, timezone

import httpx

from channels.instagram import GRAPH_BASE


def _fetch_due_creds() -> list[dict]:
    from config.supabase import get_supabase_admin
    supabase = get_supabase_admin()
    threshold = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()
    res = (
        supabase.table("tenant_instagram_credentials")
        .select("tenant_id, page_access_token, token_expires_at")
        .eq("status", "active")
        .lte("token_expires_at", threshold)
        .execute()
    )
    return res.data or []


def _refresh_token(current_token: str) -> dict:
    app_id = os.environ["FACEBOOK_APP_ID"]
    app_secret = os.environ["FACEBOOK_APP_SECRET"]
    resp = httpx.get(
        f"{GRAPH_BASE}/oauth/access_token",
        params={
            "grant_type": "fb_exchange_token",
            "client_id": app_id,
            "client_secret": app_secret,
            "fb_exchange_token": current_token,
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def _update_creds(tenant_id: str, **updates) -> None:
    from config.supabase import get_supabase_admin
    supabase = get_supabase_admin()
    supabase.table("tenant_instagram_credentials").update(updates).eq(
        "tenant_id", tenant_id
    ).execute()


def refresh_due_tokens() -> int:
    """Refresh all IG tokens expiring within 7 days.
    Returns number of tokens refreshed."""
    count = 0
    for row in _fetch_due_creds():
        tenant_id = row["tenant_id"]
        current = row["page_access_token"]
        try:
            result = _refresh_token(current)
            new_token = result["access_token"]
            expires_in = result.get("expires_in", 5184000)
            new_expires = (
                datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            ).isoformat()
            _update_creds(
                tenant_id,
                page_access_token=new_token,
                token_expires_at=new_expires,
            )
            count += 1
        except Exception as e:
            # Mark second failure path: skip after first retry
            _update_creds(tenant_id, status="revoked")
            print(f"[IG refresh] revoked {tenant_id}: {e}")
    return count
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd cubrejardin-bot
pytest tests/test_instagram_token_refresh.py -v
```

Expected: PASS.

- [ ] **Step 5: Wire into existing cron**

Find the cron entrypoint that runs WA token refresh (search for `refresh_whatsapp_tokens` or similar). Add after it:

```python
from jobs.refresh_instagram_tokens import refresh_due_tokens
refresh_due_tokens()
```

- [ ] **Step 6: Commit**

```bash
cd cubrejardin-bot
git add jobs/refresh_instagram_tokens.py tests/test_instagram_token_refresh.py
git commit -m "feat(jobs): daily IG token refresh cron"
```


---

## Phase D — Backend: Webhook integration

### Task D.1: Extend webhook router to detect IG payloads

**Files:**
- Modify: `cubrejardin-bot/api/webhooks.py`
- Modify: `cubrejardin-bot/main.py` (if verify endpoint exists)

- [ ] **Step 1: Read existing webhook verify handler**

Find the GET handler that verifies the webhook (look for `hub.challenge` or `hub.mode` in `api/webhooks.py` and/or `main.py`). Confirm it accepts any `hub.mode=subscribe & hub.verify_token=...` regardless of object.

- [ ] **Step 2: Write failing test for IG webhook parse**

`cubrejardin-bot/tests/test_webhook_ig.py`:

```python
from fastapi.testclient import TestClient
from unittest.mock import patch

from main import app

client = TestClient(app)


def test_ig_webhook_persists_message_and_dispatches_bot():
    payload = {
        "object": "instagram",
        "entry": [{
            "id": "PAGE_ID_999",
            "messaging": [{
                "sender": {"id": "IGSID_USER_42"},
                "recipient": {"id": "IGSID_PAGE"},
                "message": {"mid": "m_z", "text": "precio?"},
            }],
        }],
    }

    with patch("api.webhooks._resolve_tenant_for_instagram", return_value="TENANT_UUID"), \
         patch("api.webhooks._persist_conversation_message") as persist, \
         patch("api.webhooks._run_bot_pipeline") as run_bot:
        resp = client.post(
            "/webhook",
            json=payload,
            headers={"X-Hub-Signature-256": "sha256=FAKE"},
        )
    assert resp.status_code == 200
    persist.assert_called_once()
    call_kwargs = persist.call_args.kwargs
    assert call_kwargs["channel"] == "instagram"
    assert call_kwargs["channel_user_id"] == "IGSID_USER_42"
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd cubrejardin-bot
pytest tests/test_webhook_ig.py -v
```

Expected: FAIL (IG payload not handled, 400 or no persist call).

- [ ] **Step 4: Refactor webhook handler**

In `cubrejardin-bot/api/webhooks.py`, locate the POST handler that parses the payload and dispatches to WA bot pipeline. Replace the body parsing with:

```python
from channels.registry import known_channels, get_adapter
from api.webhooks_helpers import (  # extract these into helpers below
    resolve_tenant_for_whatsapp,
    resolve_tenant_for_instagram,
    persist_conversation_message,
    run_bot_pipeline,
)


@router.post("/webhook")
async def webhook(payload: dict):
    object_type = payload.get("object")
    if object_type == "whatsapp-business-account":
        channel = "whatsapp"
        tenant_id = resolve_tenant_for_whatsapp(payload)
    elif object_type == "instagram":
        channel = "instagram"
        tenant_id = resolve_tenant_for_instagram(payload)
    else:
        return {"status": "ignored"}

    adapter = get_adapter(channel)
    messages = adapter.parse_webhook(payload)
    for msg in messages:
        persist_conversation_message(
            tenant_id=tenant_id,
            channel=channel,
            channel_user_id=msg.external_user_id,
            role="user",
            message=msg.text,
            metadata=msg.metadata,
        )
        await run_bot_pipeline(
            tenant_id=tenant_id,
            channel=channel,
            channel_user_id=msg.external_user_id,
            user_message=msg.text,
        )
    return {"status": "ok", "count": len(messages)}
```

Create `cubrejardin-bot/api/webhooks_helpers.py`:

```python
from config.supabase import get_supabase_admin


def resolve_tenant_for_whatsapp(payload: dict) -> str:
    """Existing logic — move here untouched."""
    phone_number_id = (
        payload["entry"][0]["changes"][0]["value"]
        ["metadata"]["phone_number_id"]
    )
    supabase = get_supabase_admin()
    res = (
        supabase.table("tenant_whatsapp_credentials")
        .select("tenant_id")
        .eq("phone_number_id", phone_number_id)
        .eq("active", True)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return res.data["tenant_id"]


def resolve_tenant_for_instagram(payload: dict) -> str:
    page_id = payload["entry"][0]["id"]
    supabase = get_supabase_admin()
    res = (
        supabase.table("tenant_instagram_credentials")
        .select("tenant_id")
        .eq("page_id", page_id)
        .eq("status", "active")
        .limit(1)
        .maybe_single()
        .execute()
    )
    if not res.data:
        raise ValueError(f"No tenant for IG page {page_id}")
    return res.data["tenant_id"]


def persist_conversation_message(*, tenant_id, channel, channel_user_id,
                                 role, message, metadata):
    supabase = get_supabase_admin()
    supabase.table("conversations").insert({
        "tenant_id": tenant_id,
        "channel": channel,
        "channel_user_id": channel_user_id,
        "role": role,
        "message": message,
        "metadata": metadata or {},
    }).execute()


async def run_bot_pipeline(*, tenant_id, channel, channel_user_id, user_message):
    """Existing bot-pipeline runner; route outbound through channel adapter."""
    from agents.orchestrator import handle_inbound  # existing
    from channels.registry import get_adapter

    response_text = await handle_inbound(
        tenant_id=tenant_id,
        user_number=channel_user_id,  # ← orchestrator treats this generically
        message=user_message,
    )
    if response_text:
        adapter = get_adapter(channel)
        adapter.send_message(
            recipient_id=channel_user_id,
            text=response_text,
            tenant_id=tenant_id,
        )
```

If the existing handler does not call handle_inbound in this exact shape, pass `channel` through and have `run_bot_pipeline` add `channel` to the persist for the assistant reply (so conversation rows are properly tagged).

- [ ] **Step 5: Update existing WA webhook test to handle new shape**

If `tests/test_webhook.py` asserts on the old response shape, update those assertions to match. Do not change behavior for WA.

- [ ] **Step 6: Run both webhook tests**

```bash
cd cubrejardin-bot
pytest tests/test_webhook.py tests/test_webhook_ig.py -v
```

Expected: PASS, no regression.

- [ ] **Step 7: Commit**

```bash
cd cubrejardin-bot
git add api/webhooks.py api/webhooks_helpers.py tests/test_webhook_ig.py tests/test_webhook.py
git commit -m "feat(webhooks): unified router for whatsapp + instagram"
```


---

### Task D.2: Extend /api/tenants/me with IG status

**Files:**
- Modify: `cubrejardin-bot/api/tenants.py` (locate the `/api/tenants/me` handler)

- [ ] **Step 1: Write failing test**

Add to `tests/test_tenant_me.py` (or create it):

```python
def test_me_returns_instagram_connected_flag():
    with patch("api.tenants._fetch_whatsapp_state", return_value={"whatsapp_connected": True}), \
         patch("api.tenants._fetch_instagram_state", return_value={"instagram_connected": False}):
        resp = client.get("/api/tenants/me",
                          headers={"Authorization": "Bearer FAKE"})
    assert resp.json()["instagram_connected"] is False
```

- [ ] **Step 2: Modify the handler**

In the `/api/tenants/me` response, add:

```python
return {
    ...existing...,
    "whatsapp_connected": ...,
    "instagram_connected": _fetch_instagram_state(tenant_id)["instagram_connected"],
}


def _fetch_instagram_state(tenant_id: str) -> dict:
    from config.supabase import get_supabase_admin
    supabase = get_supabase_admin()
    res = (
        supabase.table("tenant_instagram_credentials")
        .select("status")
        .eq("tenant_id", tenant_id)
        .limit(1)
        .maybe_single()
        .execute()
    )
    return {"instagram_connected": bool(res.data and res.data.get("status") == "active")}
```

- [ ] **Step 3: Run + commit**

```bash
cd cubrejardin-bot
pytest tests/test_tenant_me.py -v
git add api/tenants.py tests/test_tenant_me.py
git commit -m "feat(api): /tenants/me exposes instagram_connected"
```

### Task D.3: Conversations endpoint accepts `?channel=` filter

Required by frontend Task F.2 step 5. Without this, clicking the "Instagram" tab returns the full WA-only list.

**Files:**
- Modify: `cubrejardin-bot/api/conversations.py`
- Create: `cubrejardin-bot/tests/test_conversations_filter.py`

- [ ] **Step 1: Write failing test**

```python
from fastapi.testclient import TestClient
from unittest.mock import patch
from main import app

client = TestClient(app)


def test_conversations_filter_by_channel_instagram():
    fake_rows = [
        {"channel": "instagram", "channel_user_id": "IGSID_1",
         "last_message": "hi", "last_at": "2026-07-12T00:00:00Z", "count": 1},
    ]
    with patch("api.conversations._list_contacts", return_value=fake_rows):
        resp = client.get("/api/conversations?channel=instagram",
                          headers={"Authorization": "Bearer FAKE"})
    assert resp.status_code == 200
    assert resp.json()["contacts"][0]["channel"] == "instagram"
```

- [ ] **Step 2: Run test, expect FAIL**

```bash
cd cubrejardin-bot
pytest tests/test_conversations_filter.py -v
```

Expected: FAIL (filter ignored or test gets WA rows).

- [ ] **Step 3: Modify the handler**

In the GET handler that returns the contacts list, accept `channel: str | None = None` and add `.eq("channel", channel)` to the supabase query when present. Default is `None` → all channels.

```python
@router.get("/conversations")
def list_conversations(
    channel: str | None = None,
    tenant_id: str = Depends(get_current_tenant),
):
    contacts = _list_contacts(tenant_id=tenant_id, channel=channel)
    return {"contacts": contacts}


def _list_contacts(tenant_id: str, channel: str | None) -> list[dict]:
    from config.supabase import get_supabase_admin
    supabase = get_supabase_admin()
    q = (
        supabase.table("conversations")
        .select("channel, channel_user_id, message, created_at")
        .eq("tenant_id", tenant_id)
        .order("created_at", desc=True)
        .limit(1000)
    )
    if channel:
        q = q.eq("channel", channel)
    rows = q.execute().data or []
    grouped: dict[tuple[str, str], dict] = {}
    for r in rows:
        key = (r["channel"], r["channel_user_id"])
        if key not in grouped:
            grouped[key] = {
                "channel": r["channel"],
                "channel_user_id": r["channel_user_id"],
                "last_message": r["message"],
                "last_at": r["created_at"],
                "count": 1,
            }
        else:
            grouped[key]["count"] += 1
    return list(grouped.values())
```

Note: if the existing handler already has query logic, replace just the query builder portion and preserve any extra returned fields (`metadata`, etc.) the frontend needs.

- [ ] **Step 4: Run test, expect PASS**

```bash
cd cubrejardin-bot
pytest tests/test_conversations_filter.py -v
```

Expected: PASS.

- [ ] **Step 5: Run existing conversations/handoff tests to check no regression**

```bash
pytest tests/ -k "conversation or handoff" -v
```

Expected: PASS or fixes documented.

- [ ] **Step 6: Commit**

```bash
cd cubrejardin-bot
git add api/conversations.py tests/test_conversations_filter.py
git commit -m "feat(api): conversations list supports channel filter"
```



---

## Phase E — Frontend: connection flow

### Task E.1: InstagramSignupButton component

**Files:**
- Create: `astro-sg-cloud/src/components/widgets/InstagramSignupButton.tsx`

- [ ] **Step 1: Create the component**

This is a parallel of `FacebookSignupButton.tsx` with the IG-only flow:

`astro-sg-cloud/src/components/widgets/InstagramSignupButton.tsx`:

```tsx
import { useEffect, useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { supabase } from '~/lib/supabase';

declare global {
  interface Window {
    FB: {
      init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: { authResponse?: { code: string } }) => void,
        options?: {
          config_id?: string;
          response_type?: string;
          override_default_response_type?: boolean;
          scope?: string;
          extras?: Record<string, unknown>;
        }
      ) => void;
    };
    fbAsyncInit: () => void;
  }
}

interface Props {
  configId: string;
  locale?: 'es' | 'en';
}

const translations = {
  es: {
    connect: 'Conectar Instagram',
    connecting: 'Conectando...',
    loading: 'Cargando...',
    sdkError: 'Facebook SDK no cargado. Recarga la pagina.',
    cancelled: 'Autorizacion cancelada o incompleta.',
    saveError: 'Error al guardar. Intenta de nuevo.',
    noIgLinked: 'No se encontro una cuenta Instagram Profesional vinculada.',
    successTitle: 'Instagram Conectado!',
    successDesc: 'Tu cuenta IG Professional esta vinculada y lista para recibir mensajes.',
    goToDashboard: 'Ir al Panel',
  },
  en: {
    connect: 'Connect Instagram',
    connecting: 'Connecting...',
    loading: 'Loading...',
    sdkError: 'Facebook SDK not loaded. Please refresh the page.',
    cancelled: 'Authorization was cancelled or incomplete.',
    saveError: 'Failed to save. Please try again.',
    noIgLinked: 'No Instagram Professional account found linked to your Pages.',
    successTitle: 'Instagram Connected!',
    successDesc: 'Your IG Professional account is linked and ready to receive messages.',
    goToDashboard: 'Go to Dashboard',
  },
};

const InstagramSignupButton: FunctionalComponent<Props> = ({ configId, locale = 'es' }) => {
  const t = translations[locale];
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window.FB !== 'undefined') {
      setIsSdkReady(true);
      return;
    }
    const handler = () => setIsSdkReady(true);
    window.addEventListener('facebook-sdk-ready', handler);
    return () => window.removeEventListener('facebook-sdk-ready', handler);
  }, []);

  const exchange = async (code: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const apiUrl = import.meta.env.PUBLIC_API_URL;
    const redirectUri = window.location.origin + (locale === 'en' ? '/en/' : '/') + 'onboarding';
    const resp = await fetch(`${apiUrl}/api/instagram/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ auth_code: code, redirect_uri: redirectUri }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || 'Backend exchange failed');
    }
    return resp.json();
  };

  const handleClick = () => {
    if (!isSdkReady || typeof window.FB === 'undefined') {
      setErrorMessage(t.sdkError);
      setStatus('error');
      return;
    }
    setStatus('loading');

    let pageId = '';
    let igUserId = '';

    window.FB.login(
      (response) => {
        if (response.authResponse?.code) {
          exchange(response.authResponse.code)
            .then(() => setStatus('success'))
            .catch((e) => {
              setErrorMessage(e.message || t.saveError);
              setStatus('error');
            });
        } else {
          setErrorMessage(t.cancelled);
          setStatus('error');
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        scope: 'instagram_basic,instagram_manage_messages,pages_show_list',
        extras: {
          feature: 'instagram_embedded_signup',
          sessionInfoListener: (info: { page_id?: string; ig_user_id?: string }) => {
            pageId = info.page_id || '';
            igUserId = info.ig_user_id || '';
          },
        },
      }
    );
  };

  if (status === 'success') {
    return (
      <div class="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg text-center">
        <h3 class="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">{t.successTitle}</h3>
        <p class="text-green-800 dark:text-green-200 mb-4">{t.successDesc}</p>
        <a href={locale === 'en' ? '/en/dashboard' : '/dashboard'}
           class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 hover:bg-green-700 rounded-md">
          {t.goToDashboard}
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div class="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-center">
        <p class="text-red-700 dark:text-red-300 mb-4">{errorMessage}</p>
        <button onClick={() => { setStatus('idle'); setErrorMessage(''); }}
                class="px-6 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">
          {locale === 'es' ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!isSdkReady || status === 'loading'}
      class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-pink-500 via-red-500 to-yellow-500 hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 shadow-lg"
    >
      {status === 'loading' ? t.connecting : isSdkReady ? t.connect : t.loading}
    </button>
  );
};

export default InstagramSignupButton;
```

- [ ] **Step 2: Verify build**

```bash
cd astro-sg-cloud
pnpm astro check
pnpm build
```

Expected: 0 errors. The new component is unused for now.

- [ ] **Step 3: Commit**

```bash
cd astro-sg-cloud
git add src/components/widgets/InstagramSignupButton.tsx
git commit -m "feat(frontend): InstagramSignupButton component"
```


---

### Task E.2: Dashboard IG card

**Files:**
- Modify: `astro-sg-cloud/src/components/widgets/Dashboard.tsx`

- [ ] **Step 1: Add i18n strings**

In the `translations` object, add to both `es` and `en`:

```ts
instagramConnect: 'Conectar Instagram',
instagramConnectDesc: 'Vincula tu cuenta Instagram Professional',
instagramConnected: 'Instagram Conectado',
instagramConnectedDesc: 'Tu cuenta Instagram Professional esta vinculada',
instagramExpired: 'Tu token de Instagram ha expirado.',
instagramReconnect: 'Reconectar Instagram',
```

- [ ] **Step 2: Add state + fetch**

After the existing `setWhatsappConnected` block in `useEffect`, add:

```tsx
const [igConnected, setIgConnected] = useState(false);
const [igTokenExpiresAt, setIgTokenExpiresAt] = useState<Date | null>(null);
// ...inside load():
const igResp = await fetch(`${apiUrl}/api/instagram/status`, { headers });
if (igResp.ok) {
  const d = await igResp.json();
  setIgConnected(d.instagram_connected === true);
  if (d.token_expires_at) setIgTokenExpiresAt(new Date(d.token_expires_at));
}
```

(Use the same API base constant as for WA.)

- [ ] **Step 3: Render the card**

In the JSX, just below the WhatsApp card, add a parallel block:

```tsx
<a
  href="#"
  onClick={(e) => { e.preventDefault(); /* open IG signup modal */ }}
  class={`block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border ${igConnected ? 'border-pink-300 dark:border-pink-700' : 'border-gray-200 dark:border-gray-700'}`}
>
  <div class="flex items-center gap-3 mb-3">
    <svg class="w-8 h-8 text-pink-500" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.5.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.3.6.5 1.3.5 2.3.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.5 2.3-.2.6-.5 1.1-1 1.6-.5.5-1 .8-1.6 1-.6.3-1.3.5-2.3.5-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.5-.6-.2-1.1-.5-1.6-1-.5-.5-.8-1-1-1.6-.3-.6-.5-1.3-.5-2.3-.1-1.1-.1-1.4-.1-4.1s0-3 .1-4.1c0-1 .2-1.7.5-2.3.2-.6.5-1.1 1-1.6.5-.5 1-.8 1.6-1 .6-.3 1.3-.5 2.3-.5C9 2.2 9.3 2.2 12 2.2zm0 5.1c-2.6 0-4.7 2.1-4.7 4.7s2.1 4.7 4.7 4.7 4.7-2.1 4.7-4.7-2.1-4.7-4.7-4.7zm5-.4c-.6 0-1.1.5-1.1 1.1s.5 1.1 1.1 1.1 1.1-.5 1.1-1.1-.5-1.1-1.1-1.1z"/>
    </svg>
    <h3 class="text-lg font-semibold dark:text-white">
      {igConnected ? t.instagramConnected : t.instagramConnect}
    </h3>
  </div>
  <p class="text-sm text-gray-600 dark:text-gray-400">
    {igConnected ? t.instagramConnectedDesc : t.instagramConnectDesc}
  </p>
  {igConnected && igTokenExpiresAt && igTokenExpiresAt < new Date() && (
    <div class="mt-3 text-sm text-red-600 dark:text-red-400">
      {t.instagramExpired} · <button class="underline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>{t.instagramReconnect}</button>
    </div>
  )}
</a>
```

For "open IG signup modal" — wire this to `InstagramSignupButton` rendered in a portal/modal. For MVP, link directly to the IG signup modal rendered below the dashboard grid:

```tsx
{showIgModal && (
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowIgModal(false)}>
    <div class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md" onClick={(e) => e.stopPropagation()}>
      <InstagramSignupButton
        configId={import.meta.env.PUBLIC_INSTAGRAM_CONFIG_ID || ''}
        locale={locale}
      />
    </div>
  </div>
)}
```

Add `const [showIgModal, setShowIgModal] = useState(false);` and replace the `#` href with the modal opener.

- [ ] **Step 4: Build + commit**

```bash
cd astro-sg-cloud
pnpm astro check
pnpm build
git add src/components/widgets/Dashboard.tsx
git commit -m "feat(dashboard): instagram connect card"
```


---

### Task E.3: Onboarding wizard — step 1 becomes multi-channel

**Files:**
- Modify: `astro-sg-cloud/src/components/widgets/OnboardingWizard.tsx`

- [ ] **Step 1: Refactor step 1 to query both `/tenants/me` channels**

Replace the single `waResp` fetch with:

```tsx
const meResp = await fetch(`${apiUrl}/api/tenants/me`, { headers });
if (meResp.ok) {
  const d = await meResp.json();
  setWaConnected(!!d.whatsapp_connected);
  setIgConnected(!!d.instagram_connected);
}
```

Add `const [igConnected, setIgConnected] = useState(false);`.

- [ ] **Step 2: Render both buttons + statuses**

In step 1 JSX, show two cards side-by-side. WA shows `FacebookSignupButton` (only for WA feature), IG shows `InstagramSignupButton`. Each shows "✓ Conectado" when its state is true.

- [ ] **Step 3: Update step labels + translations**

Change step labels from `step1: 'WhatsApp'` to `step1: 'Conectar canales'` (and the EN equivalent). Other steps stay the same.

- [ ] **Step 4: Build + commit**

```bash
cd astro-sg-cloud
pnpm astro check
pnpm build
git add src/components/widgets/OnboardingWizard.tsx
git commit -m "feat(onboarding): step 1 connects whatsapp + instagram"
```


---

## Phase F — Frontend: inbox filter

### Task F.1: ChannelBadge component

**Files:**
- Create: `astro-sg-cloud/src/components/widgets/ChannelBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
interface Props { channel: 'whatsapp' | 'instagram'; }

const labels = {
  whatsapp: { text: 'WA', classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  instagram: { text: 'IG', classes: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
};

export default function ChannelBadge({ channel }: Props) {
  const cfg = labels[channel];
  return (
    <span class={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cfg.classes}`}>
      {cfg.text}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd astro-sg-cloud
git add src/components/widgets/ChannelBadge.tsx
git commit -m "feat(conversations): ChannelBadge component"
```


---

### Task F.2: Add channel filter to ConversationViewer

**Files:**
- Modify: `astro-sg-cloud/src/components/widgets/ConversationViewer.tsx`

- [ ] **Step 1: Add filter state**

```tsx
const [channelFilter, setChannelFilter] = useState<'all' | 'whatsapp' | 'instagram'>('all');
```

- [ ] **Step 2: Add tabs UI at the top of contact list**

Right above the contact search box, add:

```tsx
<div class="flex gap-2 px-4 pt-3 border-b border-gray-200 dark:border-gray-700">
  {(['all', 'whatsapp', 'instagram'] as const).map((f) => (
    <button
      key={f}
      onClick={() => setChannelFilter(f)}
      class={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
        channelFilter === f
          ? 'border-blue-600 text-blue-600'
          : 'border-transparent text-gray-500 hover:text-gray-700'
      }`}
    >
      {f === 'all' ? (locale === 'es' ? 'Todos' : 'All')
        : f === 'whatsapp' ? 'WhatsApp'
        : 'Instagram'}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Filter the contact list**

When computing the displayed `contacts`, filter by `channel`:

```tsx
const filteredContacts = contacts.filter((c) =>
  channelFilter === 'all' || c.channel === channelFilter
);
```

The `Contact` interface needs a `channel` field added:

```tsx
interface Contact {
  channel: 'whatsapp' | 'instagram';
  channel_user_id: string;
  last_message: string;
  last_at: string;
  count: number;
}
```

- [ ] **Step 4: Display badge in contact row**

In the contact list render, next to the name/number, add `<ChannelBadge channel={c.channel} />`.

- [ ] **Step 5: Update API call to include channel**

Where the conversations list is fetched, pass `?channel=<filter>` when filter is not "all":

```tsx
const url = channelFilter === 'all'
  ? `${apiUrl}/api/conversations`
  : `${apiUrl}/api/conversations?channel=${channelFilter}`;
```

If `/api/conversations` does not yet support a channel filter, that backend endpoint must be updated to filter by channel. (Treated as part of this task — adjust the backend handler.)

- [ ] **Step 6: Build + commit**

```bash
cd astro-sg-cloud
pnpm astro check
pnpm build
git add src/components/widgets/ConversationViewer.tsx
git commit -m "feat(conversations): channel filter + badge in inbox"
```


---

## Phase G — Deploy + manual end-to-end

### Task G.1: Backend deploy

- [ ] **Step 1: Run all tests locally**

```bash
cd cubrejardin-bot
pytest -v
```

Expected: PASS, no regressions.

- [ ] **Step 2: Build + deploy Cloud Run**

```bash
gcloud --profile admin-test run deploy whatsapp-api \
  --source . \
  --region us-east1 \
  --allow-unauthenticated
```

- [ ] **Step 3: Apply migration to production Supabase**

Run `006_instagram_channel.sql` in Supabase SQL editor for production.

### Task G.2: Meta App config (manual, one-time)

- [ ] **Step 1: Add IG feature to Embedded Signup config**

In Meta App dashboard, find your existing `config_id` config. Add feature `instagram_embedded_signup` alongside the existing WA feature. Save.

- [ ] **Step 2: Subscribe IG to webhook**

In App dashboard → Webhooks → Configured fields, subscribe `messages` for `page` object. Use the same callback URL as WA (`https://whatsapp-api-.../webhook`).

### Task G.3: Frontend env + env var

- [ ] **Step 1: Add `PUBLIC_INSTAGRAM_CONFIG_ID`**

In `.env`:

```
PUBLIC_INSTAGRAM_CONFIG_ID=...
```

Mirror in `.env.example` (placeholder).

- [ ] **Step 2: Frontend auto-deploys** — merge to main and let Firebase CI take over.

### Task G.4: End-to-end manual test

- [ ] **Step 1: New tenant signup**

Sign up a new account → onboarding wizard → step 1 should show both buttons. Authorize in Meta popup. Verify both WA and IG show "Conectado".

- [ ] **Step 2: Send DM from external IG account**

Send a text DM. Verify in `/conversations` tab "Instagram" that the message appears. Verify bot replies (RAG).

- [ ] **Step 3: Handoff test**

Trigger handoff keyword. Verify handoff appears in conversations, agent can reply from UI, message is delivered to IG.

- [ ] **Step 4: Token expiry warning**

Manipulate `token_expires_at` in Supabase to be in the past. Verify dashboard shows expiry banner.


---

## Risks & mitigations (live reference)

| Risk | Mitigation |
|------|------------|
| Meta `sessionInfoListener` returns different field names than expected | Verify field names in Task E.1; have backend accept either `ig_user_id` / `page_id` or `page_id` from extras and resolve IG via `/me/accounts` lookup |
| Existing WA code references `user_number` without channel filter | Phase A.1 step 2 audits these and either adds filter or documents exemption |
| Migration breaks WA flow if `channel` column added with no default | Default to `'whatsapp'` in migration; verify with manual WA test post-deploy |
| IG token refresh cron path overlaps with WA | Comments in cron job, separate functions, separate upserts |
| Inbox filter returns 0 results if frontend sends wrong query param | Backend endpoint test in Phase F.2 step 5 |

## Out of scope (YAGNI, recorded for future)

- Media (images, video, audio, voice notes) — v2
- Stories replies, mentions, comments — v2
- IG templates / quick replies — Meta does not provide for IG
- Multi-Page selection — single first Page is sufficient for MVP
- Per-tenant WebSocket for inbound (still polling 4s pattern, same as WA)
