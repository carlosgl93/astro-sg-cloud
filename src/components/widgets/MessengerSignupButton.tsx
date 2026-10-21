import { useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { supabase } from '~/lib/supabase';

interface Props {
  configId: string;
  locale?: 'es' | 'en';
  onSuccess?: () => void;
  label?: string;
}

const translations = {
  es: {
    connect: 'Conectar Messenger',
    connecting: 'Conectando...',
    popupBlocked: 'No se pudo abrir la ventana emergente. Permite popups para este sitio.',
    cancelled: 'Autorizacion cancelada o incompleta.',
    saveError: 'Error al guardar. Intenta de nuevo.',
    successTitle: 'Messenger Conectado!',
    successDesc: 'Tu Pagina de Facebook esta vinculada y lista para recibir mensajes.',
    goToDashboard: 'Ir al Panel',
    retry: 'Reintentar',
  },
  en: {
    connect: 'Connect Messenger',
    connecting: 'Connecting...',
    popupBlocked: 'Popup blocked. Please allow popups for this site.',
    cancelled: 'Authorization was cancelled or incomplete.',
    saveError: 'Failed to save. Please try again.',
    successTitle: 'Messenger Connected!',
    successDesc: 'Your Facebook Page is linked and ready to receive messages.',
    goToDashboard: 'Go to Dashboard',
    retry: 'Retry',
  },
};

const MessengerSignupButton: FunctionalComponent<Props> = ({ configId, locale = 'es', onSuccess, label }) => {
  const t = translations[locale];
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const exchange = async (code: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');
    const apiUrl = import.meta.env.PUBLIC_API_URL || 'https://whatsapp-api-250058155586.us-central1.run.app';
    const redirectUri = window.location.origin + (locale === 'en' ? '/en/' : '/') + 'instagram-callback';
    const body: Record<string, unknown> = {
      auth_code: code,
      redirect_uri: redirectUri,
    };
    if (configId && configId.trim().length > 0) {
      body.config_id = configId;
    }
    const resp = await fetch(`${apiUrl}/api/messenger/exchange`, {
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
    });
    if (configId && configId.trim().length > 0) {
      params.set('config_id', configId);
    }
    const oauthUrl = `https://www.facebook.com/v21.0/dialog/oauth?${params.toString()}`;

    const popup = window.open(oauthUrl, 'messenger-oauth', 'width=600,height=700');
    if (!popup) {
      setErrorMessage(t.popupBlocked);
      setStatus('error');
      return;
    }

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
      <div class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 rounded-lg text-center">
        <p class="text-sm font-semibold text-green-900 dark:text-green-100">{t.successTitle}</p>
        <p class="text-xs text-green-800 dark:text-green-200 mt-1">{t.successDesc}</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded-lg text-center">
        <p class="text-xs text-red-700 dark:text-red-300 mb-2">{errorMessage}</p>
        <button
          onClick={() => {
            setStatus('idle');
            setErrorMessage('');
          }}
          class="px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={status === 'loading'}
      class="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow"
    >
      {status === 'loading' ? t.connecting : label || t.connect}
    </button>
  );
};

export default MessengerSignupButton;
