import { useState } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import PasswordInput from './PasswordInput';

interface Props {
  locale?: 'es' | 'en';
}

const translations = {
  es: {
    title: 'Iniciar Sesion',
    email: 'Correo electronico',
    password: 'Contrasena',
    login: 'Iniciar Sesion',
    noAccount: 'No tienes cuenta?',
    signup: 'Registrate',
    error: 'Error al iniciar sesion. Verifica tus credenciales.',
    forgotPassword: 'Olvidaste tu contrasena?',
  },
  en: {
    title: 'Log In',
    email: 'Email',
    password: 'Password',
    login: 'Log In',
    noAccount: "Don't have an account?",
    signup: 'Sign up',
    error: 'Login failed. Please check your credentials.',
    forgotPassword: 'Forgot your password?',
  },
};

export default function LoginForm({ locale = 'es' }: Props) {
  const t = translations[locale];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(t.error);
      setLoading(false);
      return;
    }

    const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard';
    window.location.href = dashboardPath;
  };

  const signupPath = locale === 'en' ? '/en/signup' : '/signup';
  const forgotPath = locale === 'en' ? '/en/forgot-password' : '/forgot-password';

  return (
    <div class="max-w-md mx-auto">
      <h2 class="text-2xl font-bold text-center mb-6 dark:text-white">{t.title}</h2>

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

        <PasswordInput
          id="password"
          label={t.password}
          value={password}
          onInput={setPassword}
        />

        <div class="flex justify-end">
          <a href={forgotPath} class="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
            {t.forgotPassword}
          </a>
        </div>

        <button
          type="submit"
          disabled={loading}
          class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '...' : t.login}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        {t.noAccount}{' '}
        <a href={signupPath} class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
          {t.signup}
        </a>
      </p>
    </div>
  );
}
