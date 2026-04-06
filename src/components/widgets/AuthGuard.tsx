import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { supabase } from '~/lib/supabase';

interface Props {
  children: ComponentChildren;
  locale?: 'es' | 'en';
}

export default function AuthGuard({ children, locale = 'es' }: Props) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthenticated(true);
      } else {
        const loginPath = locale === 'en' ? '/en/login' : '/login';
        window.location.href = loginPath;
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthenticated(!!session);
      if (!session) {
        const loginPath = locale === 'en' ? '/en/login' : '/login';
        window.location.href = loginPath;
      }
    });

    return () => subscription.unsubscribe();
  }, [locale]);

  if (loading) {
    return (
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return <>{children}</>;
}
