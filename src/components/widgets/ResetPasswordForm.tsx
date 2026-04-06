import { useState, useEffect } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import PasswordInput from './PasswordInput';

interface Props {
  locale?: 'es' | 'en';
}

const translations = {
  es: {
    title: 'Nueva Contrasena',
    password: 'Nueva contrasena',
    confirmPassword: 'Confirmar contrasena',
    submit: 'Guardar contrasena',
    passwordMismatch: 'Las contrasenas no coinciden.',
    success: 'Contrasena actualizada. Redirigiendo...',
    error: 'No se pudo actualizar la contrasena. El enlace puede haber expirado.',
    invalidLink: 'Enlace invalido o expirado. Solicita uno nuevo.',
    requestNew: 'Solicitar nuevo enlace',
  },
  en: {
    title: 'New Password',
    password: 'New password',
    confirmPassword: 'Confirm password',
    submit: 'Save password',
    passwordMismatch: 'Passwords do not match.',
    success: 'Password updated. Redirecting...',
    error: 'Could not update password. The link may have expired.',
    invalidLink: 'Invalid or expired link. Please request a new one.',
    requestNew: 'Request new link',
  },
};

export default function ResetPasswordForm({ locale = 'es' }: Props) {
  const t = translations[locale];
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY event when the recovery token in the URL is valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
      }
    });

    // Also check if there's already an active session (user navigated back)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(t.error);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => {
      window.location.href = locale === 'en' ? '/en/dashboard' : '/dashboard';
    }, 1500);
  };

  const forgotPath = locale === 'en' ? '/en/forgot-password' : '/forgot-password';

  if (!sessionReady) {
    return (
      <div class="max-w-md mx-auto text-center">
        <p class="text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          {t.invalidLink}
        </p>
        <a href={forgotPath} class="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm">
          {t.requestNew}
        </a>
      </div>
    );
  }

  if (success) {
    return (
      <div class="max-w-md mx-auto text-center">
        <div class="text-5xl mb-4">✅</div>
        <p class="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          {t.success}
        </p>
      </div>
    );
  }

  return (
    <div class="max-w-md mx-auto">
      <h2 class="text-2xl font-bold text-center mb-6 dark:text-white">{t.title}</h2>

      {error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} class="space-y-4">
        <PasswordInput
          id="password"
          label={t.password}
          value={password}
          onInput={setPassword}
        />

        <PasswordInput
          id="confirmPassword"
          label={t.confirmPassword}
          value={confirmPassword}
          onInput={setConfirmPassword}
        />

        <button
          type="submit"
          disabled={loading}
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : t.submit}
        </button>
      </form>
    </div>
  );
}
