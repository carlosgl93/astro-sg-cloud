import { useEffect, useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { supabase } from '~/lib/supabase';

// Window.FB is declared globally in FacebookSignupButton.tsx.

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
      body: JSON.stringify({ auth_code: code, redirect_uri: redirectUri, config_id: configId }),
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
      // Standard OAuth flow (no FBL Embedded Signup). The config 1619575923013415
      // has both WA + IG features enabled, so passing config_id makes Meta show
      // the WA flow. We bypass it and let standard OAuth consent run for the
      // IG scopes below; backend discovers the IG Professional account via
      // /me/accounts after the exchange.
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        scope: 'instagram_manage_engagement,pages_messaging,pages_show_list',
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
