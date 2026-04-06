import { useState } from 'preact/hooks';
import { supabase } from '~/lib/supabase';

interface Props {
  locale?: 'es' | 'en';
}

const translations = {
  es: {
    title: 'Recuperar Contrasena',
    description: 'Ingresa tu correo y te enviaremos un enlace para restablecer tu contrasena.',
    email: 'Correo electronico',
    submit: 'Enviar enlace',
    backToLogin: 'Volver al inicio de sesion',
    success: 'Revisa tu correo. Te enviamos un enlace para restablecer tu contrasena.',
    error: 'No se pudo enviar el correo. Verifica que la direccion sea correcta.',
  },
  en: {
    title: 'Reset Password',
    description: 'Enter your email and we will send you a link to reset your password.',
    email: 'Email',
    submit: 'Send reset link',
    backToLogin: 'Back to login',
    success: 'Check your email. We sent you a link to reset your password.',
    error: 'Could not send reset email. Please verify the address is correct.',
  },
};

export default function ForgotPasswordForm({ locale = 'es' }: Props) {
  const t = translations[locale];
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const redirectTo =
      typeof window !== 'undefined'
        ? `${window.location.origin}${locale === 'en' ? '/en' : ''}/reset-password`
        : undefined;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (resetError) {
      setError(t.error);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  const loginPath = locale === 'en' ? '/en/login' : '/login';

  if (success) {
    return (
      <div class="max-w-md mx-auto text-center">
        <div class="text-5xl mb-4">📧</div>
        <p class="text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          {t.success}
        </p>
        <a href={loginPath} class="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm">
          {t.backToLogin}
        </a>
      </div>
    );
  }

  return (
    <div class="max-w-md mx-auto">
      <h2 class="text-2xl font-bold text-center mb-2 dark:text-white">{t.title}</h2>
      <p class="text-center text-sm text-gray-600 dark:text-gray-400 mb-6">{t.description}</p>

      {error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="email">
            {t.email}
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : t.submit}
        </button>
      </form>

      <p class="mt-4 text-center text-sm">
        <a href={loginPath} class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
          {t.backToLogin}
        </a>
      </p>
    </div>
  );
}
