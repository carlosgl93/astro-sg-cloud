import { useState, useEffect } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import AuthGuard from './AuthGuard';

interface Props {
  locale?: 'es' | 'en';
}

interface Message {
  id: number;
  user_number: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface Contact {
  user_number: string;
  last_message: string;
  last_at: string;
  unread: number;
}

const t = {
  es: {
    title: 'Conversaciones',
    subtitle: 'Historial de conversaciones con clientes',
    back: 'Volver al panel',
    noConversations: 'No hay conversaciones aún.',
    selectContact: 'Selecciona una conversación para verla.',
    loading: 'Cargando...',
    you: 'Bot',
    customer: 'Cliente',
    system: 'Sistema',
    search: 'Buscar número...',
    messages: (n: number) => `${n} mensaje${n !== 1 ? 's' : ''}`,
    confidence: 'Confianza',
    category: 'Categoría',
    method: 'Método',
  },
  en: {
    title: 'Conversations',
    subtitle: 'Customer conversation history',
    back: 'Back to dashboard',
    noConversations: 'No conversations yet.',
    selectContact: 'Select a conversation to view it.',
    loading: 'Loading...',
    you: 'Bot',
    customer: 'Customer',
    system: 'System',
    search: 'Search number...',
    messages: (n: number) => `${n} message${n !== 1 ? 's' : ''}`,
    confidence: 'Confidence',
    category: 'Category',
    method: 'Method',
  },
};

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-CL', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return locale === 'en' ? 'Yesterday' : 'Ayer';
  if (diffDays < 7) return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL', { weekday: 'short' });
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL', { day: 'numeric', month: 'short' });
}

function formatFull(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'es-CL', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function MetaBadge({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null;
  const display = typeof value === 'number' ? `${(value as number * 100).toFixed(0)}%` : String(value);
  return (
    <span class="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
      <span class="font-medium">{label}:</span> {display}
    </span>
  );
}

function ConversationViewerContent({ locale = 'es' }: Props) {
  const tr = t[locale];
  const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard';

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Load tenant + all messages
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: membership } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (!membership?.tenant_id) { setLoading(false); return; }
      setTenantId(membership.tenant_id);

      const { data } = await supabase
        .from('conversations')
        .select('id, user_number, role, message, metadata, created_at')
        .eq('tenant_id', membership.tenant_id)
        .order('created_at', { ascending: true });

      const rows = (data || []) as Message[];
      setMessages(rows);

      // Build contact list: last message per user_number
      const map = new Map<string, Contact>();
      for (const row of rows) {
        const existing = map.get(row.user_number);
        map.set(row.user_number, {
          user_number: row.user_number,
          last_message: row.message,
          last_at: row.created_at,
          unread: (existing?.unread ?? 0) + 1,
        });
      }
      // Sort by most recent
      const sorted = Array.from(map.values()).sort(
        (a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
      );
      setContacts(sorted);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = search
    ? contacts.filter(c => c.user_number.includes(search))
    : contacts;

  const thread = selected
    ? messages.filter(m => m.user_number === selected)
    : [];

  if (loading) {
    return (
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span class="ml-3 text-gray-600 dark:text-gray-400">{tr.loading}</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold dark:text-white">{tr.title}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{tr.subtitle}</p>
        </div>
        <a
          href={dashboardPath}
          class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
        >
          {tr.back}
        </a>
      </div>

      {contacts.length === 0 ? (
        <div class="text-center py-20 text-gray-500 dark:text-gray-400">
          <div class="text-5xl mb-4">💬</div>
          <p>{tr.noConversations}</p>
        </div>
      ) : (
        <div class="flex gap-0 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden" style="height: 70vh">
          {/* Contact list */}
          <div class="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 flex flex-col bg-gray-50 dark:bg-gray-900">
            <div class="p-3 border-b border-gray-200 dark:border-gray-700">
              <input
                type="text"
                placeholder={tr.search}
                value={search}
                onInput={e => setSearch((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div class="overflow-y-auto flex-1">
              {filtered.map(c => (
                <button
                  key={c.user_number}
                  onClick={() => setSelected(c.user_number)}
                  class={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-gray-800 transition-colors ${selected === c.user_number ? 'bg-white dark:bg-gray-800 border-l-2 border-l-blue-500' : ''}`}
                >
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium dark:text-white truncate">+{c.user_number}</span>
                    <span class="text-xs text-gray-400 flex-shrink-0 ml-2">{formatTime(c.last_at, locale)}</span>
                  </div>
                  <p class="text-xs text-gray-500 dark:text-gray-400 truncate">{c.last_message}</p>
                  <p class="text-xs text-gray-400 mt-0.5">{tr.messages(c.unread)}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Thread */}
          <div class="flex-1 flex flex-col bg-white dark:bg-gray-900 overflow-hidden">
            {!selected ? (
              <div class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
                <div class="text-center">
                  <div class="text-4xl mb-3">👈</div>
                  <p class="text-sm">{tr.selectContact}</p>
                </div>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <p class="font-medium dark:text-white">+{selected}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400">{tr.messages(thread.length)}</p>
                </div>

                {/* Messages */}
                <div class="flex-1 overflow-y-auto p-4 space-y-3">
                  {thread.map(msg => {
                    const isUser = msg.role === 'user';
                    const isSystem = msg.role === 'system';
                    const meta = msg.metadata || {};

                    return (
                      <div key={msg.id} class={`flex ${isUser ? 'justify-start' : isSystem ? 'justify-center' : 'justify-end'}`}>
                        {isSystem ? (
                          <div class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs rounded-full max-w-xs text-center">
                            {msg.message}
                          </div>
                        ) : (
                          <div class={`max-w-xs lg:max-w-md ${isUser ? '' : ''}`}>
                            <div class={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                              isUser
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                                : 'bg-blue-600 text-white rounded-tr-sm'
                            }`}>
                              {msg.message}
                            </div>
                            {/* Metadata badges */}
                            <div class={`mt-1 flex flex-wrap gap-1 ${isUser ? '' : 'justify-end'}`}>
                              {meta.confidence != null && (
                                <MetaBadge label={tr.confidence} value={meta.confidence} />
                              )}
                              {meta.faq_category && (
                                <MetaBadge label={tr.category} value={meta.faq_category as string} />
                              )}
                              {meta.method && (
                                <MetaBadge label={tr.method} value={meta.method as string} />
                              )}
                            </div>
                            <p class={`text-xs text-gray-400 mt-1 ${isUser ? '' : 'text-right'}`}>
                              {isUser ? tr.customer : tr.you} · {formatFull(msg.created_at, locale)}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConversationViewer({ locale = 'es' }: Props) {
  return (
    <AuthGuard locale={locale}>
      <ConversationViewerContent locale={locale} />
    </AuthGuard>
  );
}
