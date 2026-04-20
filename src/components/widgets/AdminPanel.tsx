import { useEffect, useState } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import AuthGuard from './AuthGuard';
import OnboardingWizard from './OnboardingWizard';

interface Props {
  apiUrl: string;
  locale?: 'es' | 'en';
}

interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  plan: string;
  owner_email: string | null;
  created_at: string | null;
}

const tr = {
  title: 'Panel de Administración',
  tenants: 'Clientes',
  newTenant: '+ Nuevo cliente',
  loading: 'Cargando...',
  noTenants: 'No hay clientes registrados.',
  name: 'Nombre',
  slug: 'Slug',
  plan: 'Plan',
  owner: 'Dueño',
  created: 'Creado',
  configure: 'Configurar',
  back: '← Volver',
  accessDenied: 'Acceso denegado. Solo super-admins.',
  createTitle: 'Crear cliente',
  clientName: 'Nombre del negocio',
  clientSlug: 'Slug (único, sin espacios)',
  ownerEmail: 'Email del dueño',
  create: 'Crear',
  creating: 'Creando...',
  cancel: 'Cancelar',
  error: 'Error. Verifica los datos e intenta de nuevo.',
};

function AdminContent({ apiUrl }: Props) {
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<TenantSummary | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', owner_email: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const getHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) h['Authorization'] = `Bearer ${session.access_token}`;
    return h;
  };

  const loadTenants = async () => {
    setLoading(true);
    const headers = await getHeaders();
    try {
      const resp = await fetch(`${apiUrl}/api/backoffice/tenants`, { headers });
      if (resp.status === 403) { setDenied(true); return; }
      if (!resp.ok) throw new Error();
      setTenants(await resp.json());
    } catch (_) {}
    setLoading(false);
  };

  useEffect(() => { loadTenants(); }, []);

  const createTenant = async () => {
    setCreating(true);
    setCreateError('');
    const headers = await getHeaders();
    try {
      const resp = await fetch(`${apiUrl}/api/backoffice/tenants`, {
        method: 'POST',
        headers,
        body: JSON.stringify(form),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setShowCreate(false);
      setForm({ name: '', slug: '', owner_email: '' });
      await loadTenants();
    } catch (_) {
      setCreateError(tr.error);
    } finally {
      setCreating(false);
    }
  };

  if (denied) return (
    <div class="max-w-2xl mx-auto px-4 py-16 text-center text-red-500 font-medium">{tr.accessDenied}</div>
  );

  // Wizard mode — acting on behalf of selected tenant
  if (selectedTenant) return (
    <div>
      <div class="max-w-2xl mx-auto px-4 pt-6">
        <button
          onClick={() => setSelectedTenant(null)}
          class="text-sm text-blue-600 hover:underline mb-4 block"
        >
          {tr.back}
        </button>
        <p class="text-xs text-gray-400 mb-2 uppercase tracking-wide font-semibold">
          Configurando: {selectedTenant.name}
        </p>
      </div>
      <OnboardingWizard apiUrl={apiUrl} locale="es" tenantId={selectedTenant.id} />
    </div>
  );

  return (
    <div class="max-w-5xl mx-auto px-4 py-8">
      <div class="flex items-center justify-between mb-8">
        <h1 class="text-2xl font-bold dark:text-white">{tr.title}</h1>
        <button
          onClick={() => setShowCreate(true)}
          class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg font-medium transition-colors"
        >
          {tr.newTenant}
        </button>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 class="text-lg font-semibold dark:text-white">{tr.createTitle}</h2>
            <div class="space-y-3">
              {[
                { key: 'name', label: tr.clientName, placeholder: 'Mi Negocio' },
                { key: 'slug', label: tr.clientSlug, placeholder: 'mi-negocio' },
                { key: 'owner_email', label: tr.ownerEmail, placeholder: 'cliente@ejemplo.com' },
              ].map(({ key, label, placeholder }) => (
                <div key={key} class="space-y-1">
                  <label class="block text-sm font-medium dark:text-gray-300">{label}</label>
                  <input
                    type={key === 'owner_email' ? 'email' : 'text'}
                    value={(form as any)[key]}
                    onInput={(e) => setForm({ ...form, [key]: (e.target as HTMLInputElement).value })}
                    placeholder={placeholder}
                    class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              ))}
            </div>
            {createError && <p class="text-sm text-red-500">{createError}</p>}
            <div class="flex justify-end gap-3 pt-2">
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                class="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                {tr.cancel}
              </button>
              <button
                onClick={createTenant}
                disabled={creating || !form.name || !form.slug}
                class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
              >
                {creating ? tr.creating : tr.create}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p class="text-gray-400">{tr.loading}</p>
      ) : tenants.length === 0 ? (
        <p class="text-gray-400">{tr.noTenants}</p>
      ) : (
        <div class="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
          <table class="w-full text-sm">
            <thead class="bg-gray-50 dark:bg-slate-800">
              <tr>
                {[tr.name, tr.plan, tr.owner, tr.created, ''].map((h) => (
                  <th key={h} class="px-4 py-3 text-left font-semibold text-gray-600 dark:text-gray-300">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
              {tenants.map((t) => (
                <tr key={t.id} class="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td class="px-4 py-3 font-medium dark:text-white">
                    {t.name}
                    <span class="ml-2 text-xs text-gray-400">/{t.slug}</span>
                  </td>
                  <td class="px-4 py-3">
                    <span class="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 capitalize">
                      {t.plan}
                    </span>
                  </td>
                  <td class="px-4 py-3 text-gray-500 dark:text-gray-400">{t.owner_email || '—'}</td>
                  <td class="px-4 py-3 text-gray-400 text-xs">
                    {t.created_at ? new Date(t.created_at).toLocaleDateString('es-CL') : '—'}
                  </td>
                  <td class="px-4 py-3 text-right">
                    <button
                      onClick={() => setSelectedTenant(t)}
                      class="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300 hover:text-blue-700 rounded-lg font-medium transition-colors"
                    >
                      {tr.configure}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AdminPanel({ apiUrl, locale = 'es' }: Props) {
  return (
    <AuthGuard locale={locale}>
      <AdminContent apiUrl={apiUrl} locale={locale} />
    </AuthGuard>
  );
}
