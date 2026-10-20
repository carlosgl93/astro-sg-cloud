import { useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { supabase } from '~/lib/supabase';

interface Props {
  configId: string;
  locale?: 'es' | 'en';
  onSuccess?: () => void;
}

/** Config must be set; backend uses it for the FBL-style token exchange. */
function hasConfigId(id: string): boolean {
  return !!id && id.trim().length > 0;
}

const translations = {
  es: {
    connect: 'Conectar Instagram',
    connecting: 'Conectando...',
    loading: 'Cargando...',
    popupBlocked: 'No se pudo abrir la ventana emergente. Permite popups para este sitio.',
    cancelled: 'Autorizacion cancelada o incompleta.',
    saveError: 'Error al guardar. Intenta de nuevo.',
    successTitle: 'Instagram Conectado!',
    successDesc: 'Tu cuenta IG Professional esta vinculada y lista para recibir mensajes.',
    goToDashboard: 'Ir al Panel',
  },
  en: {
    connect: 'Connect Instagram',
    connecting: 'Connecting...',
    loading: 'Loading...',
    popupBlocked: 'Popup blocked. Please allow popups for this site.',
    cancelled: 'Authorization was cancelled or incomplete.',
    saveError: 'Failed to save. Please try again.',
    successTitle: 'Instagram Connected!',
    successDesc: 'Your IG Professional account is linked and ready to receive messages.',
    goToDashboard: 'Go to Dashboard',
  },
};

/**
 * Server-side OAuth flow:
 *   1. window.open() to Meta's dialog with our own redirect_uri
 *      (/instagram-callback). FB.login's staticxx bridge can't be replicated
 *      by backend, so we skip FB.login entirely.
 *   2. User grants in popup. Meta redirects popup to our callback URL with
 *      ?code=X. The callback page postMessages the code to opener and closes.
 *   3. Wizard receives code, POSTs to /api/instagram/exchange with the same
 *      redirect_uri. Backend exchanges with Meta — values match, no 36008.
 */
const InstagramSignupButton: FunctionalComponent<Props> = ({ configId, locale = 'es', onSuccess }) => {
  const t = translations[locale];
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const exchange = async (code: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const apiUrl = import.meta.env.PUBLIC_API_URL;
    const redirectUri = window.location.origin + (locale === 'en' ? '/en/' : '/') + 'instagram-callback';
    const body: Record<string, unknown> = {
      auth_code: code,
      redirect_uri: redirectUri,
    };
    if (hasConfigId(configId)) {
      body.config_id = configId;
    }
    const resp = await fetch(`${apiUrl}/api/instagram/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || 'Backend exchange failed');
    }
    return resp.json();
  };

  const handleClick = () => {
    if (!hasConfigId(configId)) {
      setErrorMessage('IG FBL config id is missing. Set PUBLIC_INSTAGRAM_CONFIG_ID.');
      setStatus('error');
      return;
    }
    setStatus('loading');
    setErrorMessage('');

    const appId = import.meta.env.PUBLIC_FACEBOOK_APP_ID;
    if (!appId) {
      setErrorMessage('PUBLIC_FACEBOOK_APP_ID not set.');
      setStatus('error');
      return;
    }
    const redirectUri = window.location.origin + (locale === 'en' ? '/en/' : '/') + 'instagram-callback';
    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'instagram_manage_engagement,pages_messaging',
      config_id: configId,
    });
    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;

    const popup = window.open(oauthUrl, 'ig-oauth', 'width=600,height=700');
    if (!popup) {
      setErrorMessage(t.popupBlocked);
      setStatus('error');
      return;
    }

    // Listen for postMessage from callback page
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; code?: string; error?: string };
      if (data?.type !== 'ig-oauth-result') return;
      window.removeEventListener('message', onMessage);
      if (data.error || !data.code) {
        setErrorMessage(data.error || t.cancelled);
        setStatus('error');
        return;
      }
      exchange(data.code)
        .then(() => {
          setStatus('success');
          onSuccess?.();
        })
        .catch((e) => {
          setErrorMessage(e.message || t.saveError);
          setStatus('error');
        });
    };
    window.addEventListener('message', onMessage);

    // Detect popup closed without result
    const closedCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedCheck);
        window.removeEventListener('message', onMessage);
        if (status === 'loading') {
          setErrorMessage(t.cancelled);
          setStatus('error');
        }
      }
    }, 500);
  };

  if (status === 'success') {
    return (
      <div class="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg text-center">
        <h3 class="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">{t.successTitle}</h3>
        <p class="text-green-800 dark:text-green-200 mb-4">{t.successDesc}</p>
        <a
          href={locale === 'en' ? '/en/dashboard' : '/dashboard'}
          class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 hover:bg-green-700 rounded-md"
        >
          {t.goToDashboard}
        </a>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div class="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-center">
        <p class="text-red-700 dark:text-red-300 mb-4">{errorMessage}</p>
        <button
          onClick={() => {
            setStatus('idle');
            setErrorMessage('');
          }}
          class="px-6 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
        >
          {locale === 'es' ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-gradient-to-r from-pink-500 via-red-500-to-yellow-500 hover:opacity-90 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 shadow-lg"
      style="background: linear-gradient(to right, #ec4899, #ef4444, #f59e0b);"
    >
      {status === 'loading' ? t.connecting : t.connect}
    </button>
  );
};

export default InstagramSignupButton;
