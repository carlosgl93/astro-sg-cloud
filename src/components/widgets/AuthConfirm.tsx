import { useEffect, useState } from 'preact/hooks';
import { supabase } from '~/lib/supabase';

interface Props {
  locale?: 'es' | 'en';
}

const t = {
  es: {
    confirming: 'Confirmando tu cuenta...',
    success: 'Cuenta confirmada. Redirigiendo...',
    errorExpired: 'El enlace ha expirado. Solicita uno nuevo desde la pantalla de inicio de sesion.',
    errorGeneric: 'Error al confirmar la cuenta.',
    goLogin: 'Ir al inicio de sesion',
  },
  en: {
    confirming: 'Confirming your account...',
    success: 'Account confirmed. Redirecting...',
    errorExpired: 'The link has expired. Request a new one from the login screen.',
    errorGeneric: 'Failed to confirm account.',
    goLogin: 'Go to login',
  },
};

export default function AuthConfirm({ locale = 'es' }: Props) {
  const copy = t[locale];
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const query = new URLSearchParams(window.location.search);

    const errorCode = params.get('error_code') || query.get('error_code');
    const error = params.get('error') || query.get('error');

    if (error || errorCode) {
      setErrorMsg(errorCode === 'otp_expired' ? copy.errorExpired : copy.errorGeneric);
      setStatus('error');
      return;
    }

    // PKCE flow: supabase-js auto-exchanges ?code= on getSession()
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError || !data.session) {
        setErrorMsg(copy.errorGeneric);
        setStatus('error');
        return;
      }
      setStatus('success');
      const dashboard = locale === 'en' ? '/en/dashboard' : '/dashboard';
      setTimeout(() => { window.location.href = dashboard; }, 1500);
    });
  }, []);

  const loginPath = locale === 'en' ? '/en/login' : '/login';

  return (
    <div class="text-center py-12">
      {status === 'loading' && (
        <div>
          <div class="inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-r-transparent mb-4" />
          <p class="text-gray-600 dark:text-gray-300">{copy.confirming}</p>
        </div>
      )}
      {status === 'success' && (
        <div>
          <div class="text-green-500 text-5xl mb-4">✓</div>
          <p class="text-gray-700 dark:text-gray-200 font-medium">{copy.success}</p>
        </div>
      )}
      {status === 'error' && (
        <div>
          <div class="text-red-500 text-5xl mb-4">✕</div>
          <p class="text-red-600 dark:text-red-400 mb-6">{errorMsg}</p>
          <a
            href={loginPath}
            class="inline-block px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
          >
            {copy.goLogin}
          </a>
        </div>
      )}
    </div>
  );
}
