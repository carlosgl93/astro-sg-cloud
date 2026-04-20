import { useEffect, useState } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';
import { supabase } from '~/lib/supabase';

// Facebook SDK type definitions
declare global {
  interface Window {
    FB: {
      init: (params: { appId: string; cookie?: boolean; xfbml?: boolean; version: string }) => void;
      login: (
        callback: (response: FacebookAuthResponse) => void,
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

interface FacebookSignupButtonProps {
  configId: string;
  locale?: 'es' | 'en';
}

type SignupState = 'idle' | 'loading' | 'connected' | 'success' | 'error';

interface FacebookAuthResponse {
  authResponse?: {
    code: string;
    userID?: string;
  };
  status?: string;
}

const translations = {
  es: {
    connect: 'Conectar con Facebook',
    connecting: 'Conectando...',
    loading: 'Cargando...',
    sdkError: 'Facebook SDK no cargado. Recarga la pagina.',
    cancelled: 'Autorizacion cancelada o incompleta.',
    saveError: 'Error al guardar la autenticacion. Intenta de nuevo.',
    successTitle: 'Conexion Exitosa!',
    successDesc:
      'Tu cuenta de Facebook Business ha sido conectada exitosamente.',
    goToDashboard: 'Ir al Panel de Control',
    failTitle: 'Conexion Fallida',
    retry: 'Intentar de Nuevo',
    alreadyConnected: 'WhatsApp Business ya esta conectado.',
    alreadyConnectedDesc: 'Tu cuenta ya esta vinculada. Puedes gestionar tus plantillas desde el panel de control.',
    reconnect: 'Reconectar cuenta',
  },
  en: {
    connect: 'Connect with Facebook',
    connecting: 'Connecting...',
    loading: 'Loading...',
    sdkError: 'Facebook SDK not loaded. Please refresh the page.',
    cancelled: 'Authorization was cancelled or incomplete.',
    saveError: 'Failed to save authentication. Please try again.',
    successTitle: 'Connection Successful!',
    successDesc:
      'Your Facebook Business account has been connected successfully.',
    goToDashboard: 'Go to Dashboard',
    failTitle: 'Connection Failed',
    retry: 'Try Again',
    alreadyConnected: 'WhatsApp Business is already connected.',
    alreadyConnectedDesc: 'Your account is already linked. You can manage your templates from the dashboard.',
    reconnect: 'Reconnect account',
  },
};

const FacebookSignupButton: FunctionalComponent<FacebookSignupButtonProps> = ({
  configId,
  locale = 'es',
}) => {
  const t = translations[locale];
  const [isSdkReady, setIsSdkReady] = useState(false);
  const [signupState, setSignupState] = useState<SignupState>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    // Check if user already has WhatsApp credentials
    const checkExistingConnection = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: membership } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.tenant_id) {
        const { data: creds } = await supabase
          .from('tenant_whatsapp_credentials')
          .select('id, status')
          .eq('tenant_id', membership.tenant_id)
          .limit(1)
          .maybeSingle();

        if (creds?.status === 'active') {
          setSignupState('connected');
        }
      }
    };

    checkExistingConnection();

    // Check if FB SDK is already loaded
    if (typeof window.FB !== 'undefined') {
      setIsSdkReady(true);
      return;
    }

    const handleSdkReady = () => setIsSdkReady(true);
    window.addEventListener('facebook-sdk-ready', handleSdkReady);

    return () => {
      window.removeEventListener('facebook-sdk-ready', handleSdkReady);
    };
  }, []);

  const exchangeCodeWithBackend = async (
    authCode: string,
    wabaId?: string,
    phoneNumberId?: string
  ) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const apiUrl = import.meta.env.PUBLIC_API_URL || 'https://whatsapp-api-250058155586.us-central1.run.app';
    const resp = await fetch(`${apiUrl}/api/auth/facebook/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        auth_code: authCode,
        waba_id: wabaId || '',
        phone_number_id: phoneNumberId || '',
      }),
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
      setSignupState('error');
      return;
    }

    setSignupState('loading');
    setErrorMessage('');

    // Capture WABA info from Embedded Signup sessionInfoListener
    let sessionWabaId = '';
    let sessionPhoneNumberId = '';

    window.FB.login(
      (response: FacebookAuthResponse) => {
        if (response.authResponse && response.authResponse.code) {
          exchangeCodeWithBackend(response.authResponse.code, sessionWabaId, sessionPhoneNumberId)
            .then(() => {
              setSignupState('success');
            })
            .catch((error) => {
              console.error('Failed to exchange auth code:', error);
              setErrorMessage(t.saveError);
              setSignupState('error');
            });
        } else {
          setErrorMessage(t.cancelled);
          setSignupState('error');
        }
      },
      {
        config_id: configId,
        response_type: 'code',
        override_default_response_type: true,
        scope: 'whatsapp_business_management,whatsapp_business_messaging',
        extras: {
          feature: 'whatsapp_embedded_signup',
          sessionInfoListener: (info: { waba_id?: string; phone_number_id?: string }) => {
            console.log('Embedded Signup session info:', info);
            sessionWabaId = info.waba_id || '';
            sessionPhoneNumberId = info.phone_number_id || '';
          },
        },
      }
    );
  };

  const handleRetry = () => {
    setSignupState('idle');
    setErrorMessage('');
  };

  const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard';

  if (signupState === 'connected') {
    return (
      <div class="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
        <svg
          class="w-16 h-16 mx-auto mb-4 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <h3 class="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">{t.alreadyConnected}</h3>
        <p class="text-green-800 dark:text-green-200 mb-4">{t.alreadyConnectedDesc}</p>
        <div class="flex flex-col sm:flex-row gap-3 justify-center">
          <a
            href={dashboardPath}
            class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
          >
            {t.goToDashboard}
          </a>
          <button
            onClick={() => setSignupState('idle')}
            class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-green-700 dark:text-green-300 border border-green-600 dark:border-green-500 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-md transition-colors"
          >
            {t.reconnect}
          </button>
        </div>
      </div>
    );
  }

  if (signupState === 'success') {
    return (
      <div class="p-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg text-center">
        <svg
          class="w-16 h-16 mx-auto mb-4 text-green-600 dark:text-green-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <h3 class="text-xl font-semibold text-green-900 dark:text-green-100 mb-2">{t.successTitle}</h3>
        <p class="text-green-800 dark:text-green-200 mb-4">{t.successDesc}</p>
        <a
          href={dashboardPath}
          class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-green-600 hover:bg-green-700 rounded-md transition-colors"
        >
          {t.goToDashboard}
        </a>
      </div>
    );
  }

  if (signupState === 'error') {
    return (
      <div class="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-center">
        <svg
          class="w-16 h-16 mx-auto mb-4 text-red-600 dark:text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 class="text-xl font-semibold text-red-900 dark:text-red-100 mb-2">{t.failTitle}</h3>
        <p class="text-red-800 dark:text-red-200 mb-4">{errorMessage || 'An unexpected error occurred.'}</p>
        <button
          onClick={handleRetry}
          class="inline-flex items-center justify-center px-6 py-3 text-base font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
        >
          {t.retry}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={!isSdkReady || signupState === 'loading'}
      class="inline-flex items-center justify-center px-8 py-4 text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg"
    >
      {signupState === 'loading' && (
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      )}
      {signupState === 'loading' ? t.connecting : isSdkReady ? t.connect : t.loading}
    </button>
  );
};

export default FacebookSignupButton;
