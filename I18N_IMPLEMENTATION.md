# Bilingual Implementation (Spanish/English)

## Overview

The SG Cloud website now supports two languages:

- **Spanish (es)** - Default language, available at root paths (e.g., `/`, `/services`, `/contact`)
- **English (en)** - Available at `/en/` prefixed paths (e.g., `/en/`, `/en/services`, `/en/contact`)

## Implementation Details

### 1. Astro i18n Configuration

Located in `astro.config.ts`:

```typescript
i18n: {
  defaultLocale: 'es',
  locales: ['es', 'en'],
  routing: {
    prefixDefaultLocale: false, // Spanish URLs don't have /es prefix
  },
}
```

### 2. Translation System

**File:** `src/i18n/translations.ts`

Centralized translation object with all site content in both languages:

- Navigation labels
- Hero sections
- Services descriptions
- Testimonials
- CTA buttons
- Footer content
- WhatsApp messages

**Usage:**

```typescript
import { useTranslations } from '~/i18n/translations';

const t = useTranslations('es'); // or 'en'
const title = t.hero.title;
```

### 3. Page Structure

#### Spanish Pages (Default)

- `src/pages/index.astro` - Homepage
- `src/pages/services.astro` - Services (needs update)
- `src/pages/contact.astro` - Contact (needs update)
- `src/pages/about.astro` - About (needs update)

#### English Pages

- `src/pages/en/index.astro` - English homepage
- `src/pages/en/services.astro` - English services
- `src/pages/en/contact.astro` - English contact
- `src/pages/en/about.astro` - English about (TODO)

### 4. Language Switcher

**Component:** `src/components/common/LanguageSwitcher.tsx`

A Preact interactive component that:

- Detects current language from URL path
- Shows current language flag and name
- Provides dropdown to switch languages
- Automatically generates correct URLs for alternate language
- Integrated in header navigation

**Props:**

- `currentLocale`: 'es' | 'en'
- `currentPath`: string (current URL path)

**Features:**

- Responsive (shows flag + name on desktop, flag only on mobile)
- Dark mode support
- Accessible (keyboard navigation, ARIA labels)
- Visual indicator for current language

### 5. Navigation Integration

**File:** `src/navigation.ts`

Factory functions for locale-aware navigation:

```typescript
const headerData = getHeaderData('es'); // Spanish nav
const headerData = getHeaderData('en'); // English nav

const footerData = getFooterData('es'); // Spanish footer
const footerData = getFooterData('en'); // English footer
```

The helper `getLocalizedPath(path, locale)` automatically adds `/en` prefix for English paths.

### 6. Updated Components

**Header.astro** now includes:

- Language switcher component with `client:load` directive
- Current locale detection from URL
- Props passed to LanguageSwitcher

```astro
const currentLocale = currentPath.startsWith('/en') ? 'en' : 'es';
<LanguageSwitcher client:load currentLocale={currentLocale} currentPath={currentPath} />
```

## URL Structure

| Page     | Spanish URL | English URL    |
| -------- | ----------- | -------------- |
| Homepage | `/`         | `/en/`         |
| Services | `/services` | `/en/services` |
| About    | `/about`    | `/en/about`    |
| Contact  | `/contact`  | `/en/contact`  |

## Blog Routes

Blog routes are **disabled** in `src/config.yaml`:

```yaml
apps:
  blog:
    isEnabled: false
```

Blog translation will be implemented later if needed.

## WhatsApp Integration

WhatsApp messages are pre-filled based on language and page:

**Spanish examples:**

- Homepage: "¡Hola! Estoy interesado en los servicios de SG Cloud."
- Contact: "¡Hola! Me gustaría discutir un proyecto con SG Cloud."

**English examples:**

- Homepage: "Hello! I'm interested in SG Cloud's services."
- Contact: "Hello! I'd like to discuss a project with SG Cloud."

## Firebase Configuration

**File:** `src/lib/firebase.ts`

Firebase SDK initialization with environment variables:

```typescript
import { getFirebaseApp, getFirestoreDb, getFirebaseStorage } from '~/lib/firebase';

const db = getFirestoreDb(); // Firestore instance
const storage = getFirebaseStorage(); // Storage instance
```

**Required environment variables** (see `.env.example`):

- `PUBLIC_FIREBASE_API_KEY`
- `PUBLIC_FIREBASE_AUTH_DOMAIN`
- `PUBLIC_FIREBASE_PROJECT_ID`
- `PUBLIC_FIREBASE_STORAGE_BUCKET`
- `PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `PUBLIC_FIREBASE_APP_ID`
- `PUBLIC_FIREBASE_MEASUREMENT_ID` (optional)

## Dependencies Added

```json
{
  "firebase": "^12.8.0",
  "preact": "^10.28.2",
  "@astrojs/preact": "^4.1.3"
}
```

## Testing

Build the site:

```bash
pnpm build
```

Check for errors:

```bash
pnpm check
```

Preview production build:

```bash
pnpm preview
```

## Next Steps

1. **Update Spanish pages** (`/services`, `/contact`, `/about`) to use translation system
2. **Create English about page** (`/en/about.astro`)
3. **Add Firebase environment variables** to deployment
4. **Test language switching** on all pages
5. **Add hreflang tags** for SEO (Astro handles this automatically with i18n config)
6. **Consider adding language detection** (optional, currently manual dropdown only)

## Notes

- **Static approach**: No geolocation detection, users manually switch via dropdown
- **SEO-friendly**: Spanish at root, English at `/en/` follows best practices
- **Astro Islands**: LanguageSwitcher is the only interactive component (Preact with `client:load`)
- **Translation completeness**: Homepage, services, contact fully translated; about page in Spanish only
- **Future enhancements**: Blog translation, automatic language detection, browser preference detection

---

**Last Updated:** January 25, 2026  
**Status:** ✅ Implemented and working (pending final Spanish page updates)
