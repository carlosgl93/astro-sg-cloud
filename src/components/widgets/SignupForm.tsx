import { useState } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import PasswordInput from './PasswordInput';

interface Props {
  locale?: 'es' | 'en';
}

const translations = {
  es: {
    title: 'Crear Cuenta',
    businessName: 'Nombre del negocio',
    email: 'Correo electronico',
    password: 'Contrasena',
    confirmPassword: 'Confirmar contrasena',
    signup: 'Crear Cuenta',
    hasAccount: 'Ya tienes cuenta?',
    login: 'Inicia sesion',
    passwordMismatch: 'Las contrasenas no coinciden.',
    errorGeneric: 'Error al crear la cuenta. Intenta de nuevo.',
    success: 'Cuenta creada. Revisa tu correo para confirmar.',
  },
  en: {
    title: 'Create Account',
    businessName: 'Business name',
    email: 'Email',
    password: 'Password',
    confirmPassword: 'Confirm password',
    signup: 'Create Account',
    hasAccount: 'Already have an account?',
    login: 'Log in',
    passwordMismatch: 'Passwords do not match.',
    errorGeneric: 'Signup failed. Please try again.',
    success: 'Account created. Check your email to confirm.',
  },
};

export default function SignupForm({ locale = 'es' }: Props) {
  const t = translations[locale];
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (password !== confirmPassword) {
      setError(t.passwordMismatch);
      return;
    }

    setLoading(true);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          business_name: businessName,
        },
      },
    });

    if (authError) {
      setError(t.errorGeneric);
      setLoading(false);
      return;
    }

    // If email confirmation is disabled, create tenant and redirect
    if (data.session) {
      try {
        const slug = businessName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        const { error: tenantError } = await supabase.rpc('create_tenant_for_user', {
          p_name: businessName,
          p_slug: slug,
        });

        if (tenantError) {
          console.error('Tenant creation error:', tenantError);
        }
      } catch (err) {
        console.error('Tenant creation failed:', err);
      }

      const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard';
      window.location.href = dashboardPath;
      return;
    }

    // Email confirmation required
    setSuccess(t.success);
    setLoading(false);
  };

  const loginPath = locale === 'en' ? '/en/login' : '/login';

  return (
    <div class="max-w-md mx-auto">
      <h2 class="text-2xl font-bold text-center mb-6 dark:text-white">{t.title}</h2>

      {error && (
        <div class="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded dark:bg-red-900/30 dark:border-red-800 dark:text-red-400">
          {error}
        </div>
      )}

      {success && (
        <div class="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded dark:bg-green-900/30 dark:border-green-800 dark:text-green-400">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="businessName">
            {t.businessName}
          </label>
          <input
            id="businessName"
            type="text"
            required
            value={businessName}
            onInput={(e) => setBusinessName((e.target as HTMLInputElement).value)}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white"
          />
        </div>

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
          {loading ? '...' : t.signup}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
        {t.hasAccount}{' '}
        <a href={loginPath} class="text-blue-600 hover:text-blue-800 dark:text-blue-400">
          {t.login}
        </a>
      </p>
    </div>
  );
}
