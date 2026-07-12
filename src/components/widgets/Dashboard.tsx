import { useEffect, useState } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import AuthGuard from './AuthGuard';
import InstagramSignupButton from './InstagramSignupButton';

interface Props {
  locale?: 'es' | 'en';
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

const translations = {
  es: {
    welcome: 'Bienvenido',
    dashboard: 'Panel de Control',
    business: 'Negocio',
    plan: 'Plan',
    templates: 'Plantillas WhatsApp',
    templatesDesc: 'Crea y administra tus plantillas de mensajes',
    documents: 'Documentos',
    documentsDesc: 'Sube documentos para entrenar tu bot de FAQs',
    conversations: 'Conversaciones',
    conversationsDesc: 'Historial de chats con tus clientes',
    whatsappConnect: 'Conectar WhatsApp',
    whatsappConnectDesc: 'Vincula tu cuenta de WhatsApp Business',
    whatsappConnected: 'WhatsApp Conectado',
    whatsappConnectedDesc: 'Tu cuenta de WhatsApp Business esta vinculada',
    setup: 'Configurar Bot',
    setupDesc: 'Configura el sistema prompt, mensaje de bienvenida y más.',
    logout: 'Cerrar Sesion',
    loading: 'Cargando...',
    noTenant: 'No se encontro un negocio asociado a tu cuenta.',
    tokenExpired: 'Tu token de WhatsApp ha expirado.',
    tokenExpiredDesc: 'Los mensajes no pueden enviarse. Reconecta tu cuenta para restaurar el servicio.',
    tokenExpiringSoon: (days: number) => `Tu token de WhatsApp expira en ${days} dia${days !== 1 ? 's' : ''}.`,
    tokenExpiringSoonDesc: 'Reconecta tu cuenta pronto para evitar interrupciones.',
    reconnect: 'Reconectar cuenta',
    instagramConnect: 'Conectar Instagram',
    instagramConnectDesc: 'Vincula tu cuenta Instagram Professional',
    instagramConnected: 'Instagram Conectado',
    instagramConnectedDesc: 'Tu cuenta Instagram Professional esta vinculada',
    instagramExpired: 'Tu token de Instagram ha expirado.',
    instagramReconnect: 'Reconectar Instagram',
  },
  en: {
    welcome: 'Welcome',
    dashboard: 'Dashboard',
    business: 'Business',
    plan: 'Plan',
    templates: 'WhatsApp Templates',
    templatesDesc: 'Create and manage your message templates',
    documents: 'Documents',
    documentsDesc: 'Upload documents to train your FAQ bot',
    conversations: 'Conversations',
    conversationsDesc: 'Chat history with your customers',
    whatsappConnect: 'Connect WhatsApp',
    whatsappConnectDesc: 'Link your WhatsApp Business account',
    whatsappConnected: 'WhatsApp Connected',
    whatsappConnectedDesc: 'Your WhatsApp Business account is linked',
    setup: 'Bot Setup',
    setupDesc: 'Configure system prompt, welcome message and more.',
    logout: 'Log Out',
    loading: 'Loading...',
    noTenant: 'No business found associated with your account.',
    tokenExpired: 'Your WhatsApp token has expired.',
    tokenExpiredDesc: 'Messages cannot be sent. Reconnect your account to restore service.',
    tokenExpiringSoon: (days: number) => `Your WhatsApp token expires in ${days} day${days !== 1 ? 's' : ''}.`,
    tokenExpiringSoonDesc: 'Reconnect your account soon to avoid interruptions.',
    reconnect: 'Reconnect account',
    instagramConnect: 'Connect Instagram',
    instagramConnectDesc: 'Link your Instagram Professional account',
    instagramConnected: 'Instagram Connected',
    instagramConnectedDesc: 'Your Instagram Professional account is linked',
    instagramExpired: 'Your Instagram token has expired.',
    instagramReconnect: 'Reconnect Instagram',
  },
};

function DashboardContent({ locale = 'es' }: Props) {
  const t = translations[locale];
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [whatsappConnected, setWhatsappConnected] = useState(false);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<Date | null>(null);
  const [igConnected, setIgConnected] = useState(false);
  const [igTokenExpiresAt, setIgTokenExpiresAt] = useState<Date | null>(null);
  const [showIgModal, setShowIgModal] = useState(false);

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      setUserEmail(user.email || '');

      // Try to find existing tenant
      const { data: membership } = await supabase
        .from('tenant_users')
        .select('tenant_id, tenants(id, name, slug, plan)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membership?.tenants) {
        const tenantData = membership.tenants as unknown as Tenant;
        setTenant(tenantData);

        // Check WhatsApp connection
        const { data: creds } = await supabase
          .from('tenant_whatsapp_credentials')
          .select('id, status, token_expires_at')
          .eq('tenant_id', tenantData.id)
          .limit(1)
          .maybeSingle();
        if (creds?.status === 'active') {
          setWhatsappConnected(true);
          if (creds.token_expires_at) {
            setTokenExpiresAt(new Date(creds.token_expires_at));
          }
        }

        // Check Instagram connection
        const apiUrl = import.meta.env.PUBLIC_API_URL;
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = session?.access_token
          ? { Authorization: `Bearer ${session.access_token}` }
          : {};
        try {
          const igResp = await fetch(`${apiUrl}/api/instagram/status`, { headers });
          if (igResp.ok) {
            const d = await igResp.json();
            setIgConnected(d.instagram_connected === true);
            if (d.token_expires_at) setIgTokenExpiresAt(new Date(d.token_expires_at));
          }
        } catch (e) {
          console.error('Instagram status fetch failed:', e);
        }

        setLoading(false);
        return;
      }

      // No tenant found — auto-create from signup metadata
      const businessName = user.user_metadata?.business_name || user.email?.split('@')[0] || 'My Business';
      const slug = businessName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      const { data: tenantId, error: rpcError } = await supabase.rpc('create_tenant_for_user', {
        p_name: businessName,
        p_slug: `${slug}-${Date.now()}`, // ensure uniqueness
      });

      if (!rpcError && tenantId) {
        // Fetch the newly created tenant
        const { data: newTenant } = await supabase
          .from('tenants')
          .select('id, name, slug, plan')
          .eq('id', tenantId)
          .maybeSingle();

        if (newTenant) {
          setTenant(newTenant as Tenant);
        }
      } else {
        console.error('Auto tenant creation failed:', rpcError);
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = locale === 'en' ? '/en/' : '/';
  };

  if (loading) {
    return (
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-600 dark:text-gray-400">{t.loading}</span>
      </div>
    );
  }

  const templatesPath = locale === 'en' ? '/en/wa-templates' : '/wa-templates';
  const connectPath = locale === 'en' ? '/en/auth-fb' : '/auth-fb';
  const documentsPath = locale === 'en' ? '/en/documents' : '/documents';
  const conversationsPath = locale === 'en' ? '/en/conversations' : '/conversations';
  const onboardingPath = locale === 'en' ? '/en/onboarding' : '/onboarding';

  const now = new Date();
  const tokenIsExpired = tokenExpiresAt !== null && tokenExpiresAt <= now;
  const daysUntilExpiry = tokenExpiresAt
    ? Math.ceil((tokenExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const tokenIsExpiringSoon = !tokenIsExpired && daysUntilExpiry !== null && daysUntilExpiry <= 7;

  return (
    <div>
      <div class="flex items-center justify-between mb-8">
        <div>
          <h1 class="text-3xl font-bold dark:text-white">{t.dashboard}</h1>
          <p class="text-gray-600 dark:text-gray-400">
            {t.welcome}, {userEmail}
          </p>
        </div>
        <button
          onClick={handleLogout}
          class="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border border-gray-300 rounded-md hover:bg-gray-50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
        >
          {t.logout}
        </button>
      </div>

      {tenant && (
        <div class="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p class="text-sm text-gray-500 dark:text-gray-400">{t.business}</p>
          <p class="text-lg font-semibold dark:text-white">{tenant.name}</p>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            {t.plan}: <span class="capitalize">{tenant.plan}</span>
          </p>
        </div>
      )}

      {!tenant && (
        <div class="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
          <p class="text-yellow-700 dark:text-yellow-400">{t.noTenant}</p>
        </div>
      )}

      {whatsappConnected && tokenIsExpired && (
        <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg flex items-start gap-3">
          <span class="text-red-500 dark:text-red-400 text-xl flex-shrink-0">⚠️</span>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-red-800 dark:text-red-200">{t.tokenExpired}</p>
            <p class="text-sm text-red-700 dark:text-red-300 mt-0.5">{t.tokenExpiredDesc}</p>
          </div>
          <a
            href={connectPath}
            class="flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            {t.reconnect}
          </a>
        </div>
      )}

      {whatsappConnected && tokenIsExpiringSoon && daysUntilExpiry !== null && (
        <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-lg flex items-start gap-3">
          <span class="text-yellow-500 dark:text-yellow-400 text-xl flex-shrink-0">⚠️</span>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-yellow-800 dark:text-yellow-200">{t.tokenExpiringSoon(daysUntilExpiry)}</p>
            <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-0.5">{t.tokenExpiringSoonDesc}</p>
          </div>
          <a
            href={connectPath}
            class="flex-shrink-0 px-4 py-2 text-sm font-medium text-yellow-900 dark:text-yellow-100 bg-yellow-200 dark:bg-yellow-700 hover:bg-yellow-300 dark:hover:bg-yellow-600 rounded-md transition-colors"
          >
            {t.reconnect}
          </a>
        </div>
      )}

      <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <a
          href={connectPath}
          class={`block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border ${whatsappConnected ? 'border-green-300 dark:border-green-700' : 'border-gray-200 dark:border-gray-700'}`}
        >
          <div class="flex items-center justify-between mb-3">
            <span class="text-3xl">📱</span>
            {whatsappConnected && (
              <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                ✓ {locale === 'en' ? 'Connected' : 'Conectado'}
              </span>
            )}
          </div>
          <h3 class="text-lg font-semibold dark:text-white mb-2">
            {whatsappConnected ? t.whatsappConnected : t.whatsappConnect}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {whatsappConnected ? t.whatsappConnectedDesc : t.whatsappConnectDesc}
          </p>
        </a>

        <button
          type="button"
          onClick={() => setShowIgModal(true)}
          class={`text-left block w-full p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border ${igConnected ? 'border-pink-300 dark:border-pink-700' : 'border-gray-200 dark:border-gray-700'}`}
        >
          <div class="flex items-center justify-between mb-3">
            <svg class="w-8 h-8 text-pink-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.2c2.7 0 3 0 4.1.1 1 0 1.7.2 2.3.5.6.2 1.1.5 1.6 1 .5.5.8 1 1 1.6.3.6.5 1.3.5 2.3.1 1.1.1 1.4.1 4.1s0 3-.1 4.1c0 1-.2 1.7-.5 2.3-.2.6-.5 1.1-1 1.6-.5.5-1 .8-1.6 1-.6.3-1.3.5-2.3.5-1.1.1-1.4.1-4.1.1s-3 0-4.1-.1c-1 0-1.7-.2-2.3-.5-.6-.2-1.1-.5-1.6-1-.5-.5-.8-1-1-1.6-.3-.6-.5-1.3-.5-2.3-.1-1.1-.1-1.4-.1-4.1s0-3 .1-4.1c0-1 .2-1.7.5-2.3.2-.6.5-1.1 1-1.6.5-.5 1-.8 1.6-1 .6-.3 1.3-.5 2.3-.5C9 2.2 9.3 2.2 12 2.2zm0 5.1c-2.6 0-4.7 2.1-4.7 4.7s2.1 4.7 4.7 4.7 4.7-2.1 4.7-4.7-2.1-4.7-4.7-4.7zm5-.4c-.6 0-1.1.5-1.1 1.1s.5 1.1 1.1 1.1 1.1-.5 1.1-1.1-.5-1.1-1.1-1.1z" />
            </svg>
            {igConnected && (
              <span class="inline-flex items-center px-2 py-1 text-xs font-medium bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400 rounded-full">
                ✓ {locale === 'en' ? 'Connected' : 'Conectado'}
              </span>
            )}
          </div>
          <h3 class="text-lg font-semibold dark:text-white mb-2">
            {igConnected ? t.instagramConnected : t.instagramConnect}
          </h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            {igConnected ? t.instagramConnectedDesc : t.instagramConnectDesc}
          </p>
          {igConnected && igTokenExpiresAt && igTokenExpiresAt < new Date() && (
            <div class="mt-3 text-sm text-red-600 dark:text-red-400">
              {t.instagramExpired} · <span class="underline">{t.instagramReconnect}</span>
            </div>
          )}
        </button>

        <a
          href={templatesPath}
          class="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div class="text-3xl mb-3">📋</div>
          <h3 class="text-lg font-semibold dark:text-white mb-2">{t.templates}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">{t.templatesDesc}</p>
        </a>

        <a
          href={documentsPath}
          class="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div class="text-3xl mb-3">📄</div>
          <h3 class="text-lg font-semibold dark:text-white mb-2">{t.documents}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">{t.documentsDesc}</p>
        </a>

        <a
          href={conversationsPath}
          class="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div class="text-3xl mb-3">💬</div>
          <h3 class="text-lg font-semibold dark:text-white mb-2">{t.conversations}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">{t.conversationsDesc}</p>
        </a>

        <a
          href={onboardingPath}
          class="block p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200 dark:border-gray-700"
        >
          <div class="text-3xl mb-3">⚙️</div>
          <h3 class="text-lg font-semibold dark:text-white mb-2">{t.setup}</h3>
          <p class="text-sm text-gray-600 dark:text-gray-400">{t.setupDesc}</p>
        </a>
      </div>

      {showIgModal && (
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowIgModal(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            class="bg-white dark:bg-gray-800 rounded-lg p-8 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <InstagramSignupButton
              configId={import.meta.env.PUBLIC_INSTAGRAM_CONFIG_ID || ''}
              locale={locale}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard({ locale = 'es' }: Props) {
  return (
    <AuthGuard locale={locale}>
      <DashboardContent locale={locale} />
    </AuthGuard>
  );
}
