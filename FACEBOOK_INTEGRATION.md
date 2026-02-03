# Facebook Embedded Signup Integration

## Overview

Facebook Embedded Signup is integrated for WhatsApp Business and Messenger chatbot connections. Users can authorize SG Cloud to access their Facebook Business accounts directly through the website.

## Setup

### 1. Environment Variables

Add to your `.env` file (see [.env.example](.env.example)):

```bash
PUBLIC_FACEBOOK_APP_ID=your-app-id-here
PUBLIC_FACEBOOK_CONFIG_ID=your-config-id-here
```

Get these from:
- **App ID**: [Facebook App Settings](https://developers.facebook.com/apps/YOUR_APP_ID/settings/basic/)
- **Config ID**: [Embedded Signup Configuration](https://developers.facebook.com/apps/YOUR_APP_ID/whatsapp-business/wa-embedded-signup/)

### 2. Facebook App Configuration

Required Facebook App setup:

1. **Create Facebook App** at [developers.facebook.com/apps](https://developers.facebook.com/apps)
2. **Add Products**:
   - WhatsApp Business Management
   - Messenger
3. **Configure Embedded Signup**:
   - Create configuration with required permissions
   - Note the Configuration ID
4. **Set OAuth Redirect URIs**:
   - Add your domain URLs (both Spanish and English):
     - `https://yourdomain.com/auth-fb`
     - `https://yourdomain.com/en/auth-fb`

## Pages

- **Spanish**: [/auth-fb](http://localhost:4321/auth-fb)
- **English**: [/en/auth-fb](http://localhost:4321/en/auth-fb)

These pages are **not indexed** (robots: noindex, nofollow) and **not in navigation**. Access is by direct link only.

## Permissions Requested

The integration requests the following Facebook permissions:

- `business_management` - Manage business settings
- `whatsapp_business_management` - Manage WhatsApp Business accounts
- `whatsapp_business_messaging` - Send and receive WhatsApp messages
- `pages_messaging` - Messenger conversations
- `pages_manage_metadata` - Access page information
- `pages_read_engagement` - Read page engagement data

## User Flow

1. User navigates to `/auth-fb` (or `/en/auth-fb`)
2. Clicks "Connect with Facebook" button
3. Facebook OAuth popup appears
4. User authorizes permissions
5. Authorization code is saved to Firestore `facebook_auth` collection
6. Success message displays with link to homepage
7. If error occurs, inline error UI appears with retry option

## Firestore Collection

Authorization codes are stored in the `facebook_auth` collection:

```typescript
{
  authCode: string,        // OAuth authorization code
  userId: string | null,   // Facebook User ID (if available)
  timestamp: serverTimestamp,
  status: 'pending',
  scope: string           // Comma-separated permission list
}
```

### Security Rules

Only creation is allowed from the client:

```
match /facebook_auth/{authId} {
  allow read: if false;  // Only backend can read
  allow create: if request.resource.data.keys().hasAll(['authCode', 'timestamp', 'status', 'scope'])
    && request.resource.data.status == 'pending';
  allow update, delete: if false;  // Only backend can modify
}
```

## Components

### [FacebookSDK.astro](src/components/common/FacebookSDK.astro)

Loads the Facebook JavaScript SDK using the Manual Async approach:

- Only loads on pages that include it
- Uses `is:inline` directive for immediate execution
- Dispatches `facebook-sdk-ready` event when SDK loads
- Follows Facebook's recommended loading pattern

**Usage:**

```astro
---
import FacebookSDK from '~/components/common/FacebookSDK.astro';
---

<Layout>
  <FacebookSDK />
  <!-- Page content -->
</Layout>
```

### [FacebookSignupButton.tsx](src/components/widgets/FacebookSignupButton.tsx)

Preact interactive component for the signup button:

- **Props**: `configId` (Facebook Embedded Signup Configuration ID)
- **States**: 
  - `idle` - Initial state
  - `loading` - Authorization in progress
  - `success` - Auth code saved successfully
  - `error` - Authorization failed
- **Features**:
  - Waits for SDK ready before enabling
  - Saves auth code to Firestore on success
  - Inline UI for success/error states (no page redirects)
  - Retry functionality on errors

**Usage:**

```astro
---
import FacebookSignupButton from '~/components/widgets/FacebookSignupButton';

const configId = import.meta.env.PUBLIC_FACEBOOK_CONFIG_ID;
---

<FacebookSignupButton client:load configId={configId} />
```

## Backend Processing

After a user authorizes, you need to:

1. **Monitor Firestore** `facebook_auth` collection for new entries
2. **Exchange authorization code** for access token:
   ```bash
   POST https://graph.facebook.com/v24.0/oauth/access_token
   ```
3. **Store access token** securely (not in Firestore - use Secret Manager)
4. **Update status** in Firestore to `completed` or `failed`
5. **Set up webhook** for WhatsApp/Messenger messages

### Recommended: Firebase Function

Create a Cloud Function to automatically process new auth codes:

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const processFacebookAuth = functions.firestore
  .document('facebook_auth/{authId}')
  .onCreate(async (snap, context) => {
    const authData = snap.data();
    const { authCode } = authData;
    
    try {
      // Exchange code for access token
      const response = await fetch(
        `https://graph.facebook.com/v24.0/oauth/access_token?` +
        `client_id=${process.env.FACEBOOK_APP_ID}&` +
        `client_secret=${process.env.FACEBOOK_APP_SECRET}&` +
        `code=${authCode}`
      );
      
      const { access_token } = await response.json();
      
      // Store in Secret Manager or secure location
      // ...
      
      // Update status
      await snap.ref.update({ status: 'completed' });
    } catch (error) {
      console.error('Failed to process auth:', error);
      await snap.ref.update({ status: 'failed', error: error.message });
    }
  });
```

## Testing

### Local Development

1. Start dev server: `pnpm dev`
2. Navigate to http://localhost:4321/auth-fb
3. Ensure environment variables are set
4. Test authorization flow

### Production Checklist

- [ ] Facebook App ID configured
- [ ] Facebook Config ID configured
- [ ] OAuth redirect URIs added in Facebook App
- [ ] Firestore rules deployed
- [ ] Backend processing (Cloud Function or similar) deployed
- [ ] WhatsApp Business Account connected
- [ ] Webhook configured for message events

## Troubleshooting

**"Facebook SDK not loaded"**
- Check `PUBLIC_FACEBOOK_APP_ID` is set
- Verify network requests aren't blocked
- Check browser console for errors

**Authorization popup blocked**
- Ensure HTTPS in production
- Check browser popup blocker settings

**"Failed to save authentication"**
- Verify Firestore is configured correctly
- Check Firestore security rules
- Inspect browser console for Firebase errors

**Code already used**
- Authorization codes are single-use
- Backend must exchange code immediately
- User needs to re-authorize if code expires

## References

- [Facebook Embedded Signup Docs](https://developers.facebook.com/docs/whatsapp/embedded-signup)
- [Facebook Login for the Web](https://developers.facebook.com/docs/facebook-login/web)
- [WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/overview)
- [Messenger Platform](https://developers.facebook.com/docs/messenger-platform)

---

**Last Updated:** January 25, 2026  
**Status:** ✅ Implemented and ready for testing
