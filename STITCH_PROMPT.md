# Prompt Maestro para Google Stitch AI — Sistema de Diseño SG Cloud

Usa el siguiente prompt completo y detallado en **Google Stitch AI** (o cualquier herramienta generativa de sistemas de diseño UI) para generar el sistema de diseño, tokens y componentes visuales para **SG Cloud**.

---

```markdown
# Google Stitch AI Design System Specification

## 1. Context & Product Persona

- **Product Name:** SG Cloud (https://sgcloud.cl)
- **Domain:** B2B Multi-tenant SaaS — AI Business Chatbots
- **Target Channels:** WhatsApp Cloud API, Facebook Messenger, Instagram Direct
- **Target Users:** Small-to-Medium Business Owners, E-commerce Operators, Support Team Leads
- **Tech Stack:** Astro 5, Preact 10, Tailwind CSS 3.4, TypeScript, Heroicons / Tabler Icons

---

## 2. Aesthetic Direction & Principles

- **Design Philosophy:** Developer-grade, high-trust, functional minimalism (similar to Linear, Supabase, Vercel, Resend).
- **Theme Support:** Native Light and Dark modes. Dark mode must use rich dark zinc/slate surfaces (`#09090b` / `#0f172a`), NOT pure washed-out grey.
- **Density:** High information density for the operational console (compact tables, structured badges, small text hierarchy `text-xs` / `text-sm`), balanced with breathable spacing in marketing pages.
- **Visual Polish:**
  - Border radii: `rounded-lg` (8px) for cards, `rounded-md` (6px) for inputs/buttons, `rounded-full` for status chips.
  - Subtle borders: 1px hairline borders (`border-slate-200` in light mode, `border-slate-800` in dark mode).
  - Subtle shadows: Soft elevation `shadow-sm` for cards, `shadow-md` for popovers/modals.

---

## 3. Design Tokens Architecture

### Color Palette

- **Brand Primary:** Electric Indigo (`#6366f1` / `#4f46e5`) — primary CTAs, active states, brand highlights.
- **Backgrounds:**
  - Light Page: `#ffffff`
  - Light Surface: `#f8fafc` (slate-50)
  - Dark Page: `#09090b` (zinc-950)
  - Dark Surface: `#18181b` (zinc-900)
- **Borders & Dividers:**
  - Light: `#e2e8f0` (slate-200)
  - Dark: `#27272a` (zinc-800)
- **Channel Brand Colors:**
  - **WhatsApp:** `#25D366` (light) / `#10b981` (dark)
  - **Facebook Messenger:** `#0084FF` (light) / `#3b82f6` (dark)
  - **Instagram Direct:** Gradient `from-[#833ab4] via-[#fd1d1d] to-[#fcb045]` for accents, `#ec4899` for pills/chips.
- **Semantic Feedback:**
  - Success / Connected: `#10b981` (emerald-500)
  - Warning / Human Queue: `#f59e0b` (amber-500)
  - Error / Disconnected: `#ef4444` (rose-500)
  - Info / In Progress: `#0ea5e9` (sky-500)

### Typography

- **Font Sans:** Inter, ui-sans-serif, system-ui, -apple-system, sans-serif
- **Font Mono:** JetBrains Mono, ui-monospace, SFMono-Regular, monospace
- **Scale:**
  - Hero Display: `text-4xl md:text-6xl font-bold tracking-tight`
  - Section Title: `text-2xl md:text-3xl font-semibold tracking-tight`
  - Card Heading: `text-lg font-medium`
  - Body Copy: `text-sm md:text-base text-slate-600 dark:text-slate-400`
  - Metadata / Timestamp: `text-xs font-mono text-slate-500`

---

## 4. Key UI Components to Generate

### Component A: `ChannelBadge`

- Renders a badge for the conversation channel origin.
- Variants: `whatsapp` (green WhatsApp icon + number), `messenger` (blue Messenger icon + page name), `instagram` (gradient Instagram icon + @handle).
- Sizes: `sm` (table row), `md` (conversation header).
- Include live status indicator dot (pulsing green for active webhook, grey for idle).

### Component B: `ChannelConnectionCard`

- Dashboard/Onboarding card for each integration.
- Structure:
  - Header: Channel Logo + Channel Name + Connection Status pill.
  - Body: Connected asset details (e.g., Phone ID `974228005784338`, Page ID, or IG username) with one-click copy.
  - Action: Connect OAuth button, Reconnect button, or Disconnect button with confirmation.

### Component C: `ConversationViewer` (3-Column Layout)

1. **Left Column (Conversation List):**
   - Search bar + Channel filter pills (`All`, `WhatsApp`, `Messenger`, `Instagram`).
   - List items showing avatar, contact identifier, last message preview, timestamp, channel badge, and human handoff badge.
2. **Center Column (Active Chat):**
   - Header with contact metadata, channel indicator, and "Take Over / Hand Back to Bot" toggle button.
   - Message bubble stream:
     - Customer message (aligned left, slate background).
     - Bot AI reply (aligned right, primary brand light tint, with confidence score & RAG citation tooltip).
     - Human agent reply (distinctive accent border, showing agent name).
   - Input composer: Textarea with quick canned responses, template selector, and send button.
3. **Right Column (Context & Knowledge Base):**
   - Tenant bot personality settings.
   - Matched FAQ / Document source preview.
   - Customer interaction history.

### Component D: `OnboardingWizard` (4-Step Stepper)

- Horizontal step progress indicator:
  1. `Channels` (Connect WhatsApp / Messenger / Instagram)
  2. `Knowledge Base` (Upload business FAQs / PDFs)
  3. `Bot Personality` (Greeting message, tone, human handoff trigger keywords)
  4. `Live Test` (Interactive chat simulator to test the bot before going live)

---

## 5. Output Deliverables Expected from Stitch

1. Tailwind CSS theme extension config (`tailwind.config.js`).
2. Global CSS variables block (`:root` and `.dark`) in `tailwind.css`.
3. Preact/JSX implementation for `ChannelBadge`, `ChannelConnectionCard`, and `ConversationViewer`.
```
