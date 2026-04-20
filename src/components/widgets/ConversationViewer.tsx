import { useState, useEffect, useRef } from 'preact/hooks';
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
  count: number;
}

interface Handoff {
  id: string;
  whatsapp_number: string;
  status: string;
  created_at: string;
  updated_at: string;
  closed_at?: string;
  closed_by?: string;
  first_response_at?: string;
  message_count?: number;
}

interface Stats {
  total: number;
  active: number;
  closed: number;
  expired: number;
  avg_duration_minutes: number | null;
  avg_first_response_minutes: number | null;
  avg_messages: number | null;
  closed_by: Record<string, number>;
}

const API_BASE = import.meta.env.PUBLIC_API_URL || 'https://whatsapp-api-250058155586.us-central1.run.app';

const t = {
  es: {
    title: 'Conversaciones',
    back: 'Panel',
    backToList: '← Volver',
    noConversations: 'No hay conversaciones aún.',
    selectContact: 'Selecciona una conversación.',
    loading: 'Cargando...',
    you: 'Bot',
    agent: 'Agente',
    customer: 'Cliente',
    system: 'Sistema',
    search: 'Buscar número...',
    messages: (n: number) => `${n} msg`,
    confidence: 'Confianza',
    category: 'Categoría',
    method: 'Método',
    handoffActive: 'Handoff activo — hablas directo con el cliente',
    handoffBadge: 'En vivo',
    closeHandoff: 'Cerrar handoff',
    closeHandoffConfirm: '¿Cerrar handoff? El bot retomará la conversación.',
    replyPlaceholder: 'Escribe tu respuesta...',
    send: 'Enviar',
    newHandoff: (n: string) => `Nuevo handoff de +${n}`,
    tabConversations: 'Conversaciones',
    tabHistory: 'Historial',
    tabStats: 'Estadísticas',
    noHistory: 'No hay handoffs cerrados aún.',
    statTotal: 'Total handoffs',
    statActive: 'Activos',
    statClosed: 'Cerrados',
    statExpired: 'Expirados',
    statAvgDuration: 'Duración promedio',
    statAvgResponse: 'Tiempo resp. inicial',
    statAvgMessages: 'Mensajes por handoff',
    statClosedBy: 'Cerrados por',
    minutes: (n: number) => `${n} min`,
    closedByLabels: { agent_ui: 'UI Web', agent_telegram: 'Telegram', auto_expired: 'Expirado', system: 'Sistema' } as Record<string, string>,
    duration: (h: Handoff) => {
      if (!h.closed_at) return '—';
      const mins = Math.round((new Date(h.closed_at).getTime() - new Date(h.created_at).getTime()) / 60000);
      return mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`;
    },
  },
  en: {
    title: 'Conversations',
    back: 'Dashboard',
    backToList: '← Back',
    noConversations: 'No conversations yet.',
    selectContact: 'Select a conversation.',
    loading: 'Loading...',
    you: 'Bot',
    agent: 'Agent',
    customer: 'Customer',
    system: 'System',
    search: 'Search number...',
    messages: (n: number) => `${n} msg`,
    confidence: 'Confidence',
    category: 'Category',
    method: 'Method',
    handoffActive: 'Active handoff — talking directly with customer',
    handoffBadge: 'Live',
    closeHandoff: 'Close handoff',
    closeHandoffConfirm: 'Close handoff? The bot will resume.',
    replyPlaceholder: 'Type your reply...',
    send: 'Send',
    newHandoff: (n: string) => `New handoff from +${n}`,
    tabConversations: 'Conversations',
    tabHistory: 'History',
    tabStats: 'Stats',
    noHistory: 'No closed handoffs yet.',
    statTotal: 'Total handoffs',
    statActive: 'Active',
    statClosed: 'Closed',
    statExpired: 'Expired',
    statAvgDuration: 'Avg duration',
    statAvgResponse: 'Avg first response',
    statAvgMessages: 'Msgs per handoff',
    statClosedBy: 'Closed by',
    minutes: (n: number) => `${n} min`,
    closedByLabels: { agent_ui: 'Web UI', agent_telegram: 'Telegram', auto_expired: 'Expired', system: 'System' } as Record<string, string>,
    duration: (h: Handoff) => {
      if (!h.closed_at) return '—';
      const mins = Math.round((new Date(h.closed_at).getTime() - new Date(h.created_at).getTime()) / 60000);
      return mins < 60 ? `${mins} min` : `${(mins / 60).toFixed(1)} h`;
    },
  },
};

type Tab = 'conversations' | 'history' | 'stats';

function formatTime(iso: string, locale: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString(locale === 'en' ? 'en-US' : 'es-CL', { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return locale === 'en' ? 'Yesterday' : 'Ayer';
  if (diffDays < 7) return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL', { weekday: 'short' });
  return d.toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL', { day: 'numeric', month: 'short' });
}

function formatFull(iso: string, locale: string) {
  return new Date(iso).toLocaleString(locale === 'en' ? 'en-US' : 'es-CL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

function MetaBadge({ label, value }: { label: string; value: unknown }) {
  if (value == null || value === '') return null;
  const display = typeof value === 'number' ? `${((value as number) * 100).toFixed(0)}%` : String(value);
  return (
    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
      <span class="font-medium">{label}:</span> {display}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
      <p class="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p class="text-2xl font-bold dark:text-white">{value ?? '—'}</p>
      {sub && <p class="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function buildContacts(rows: Message[]): Contact[] {
  const map = new Map<string, Contact>();
  for (const row of rows) {
    map.set(row.user_number, {
      user_number: row.user_number,
      last_message: row.message,
      last_at: row.created_at,
      count: (map.get(row.user_number)?.count ?? 0) + 1,
    });
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
  );
}

function triggerNotification(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(p => {
      if (p === 'granted') new Notification(title, { body, icon: '/favicon.ico' });
    });
  }
}

function ConversationViewerContent({ locale = 'es' }: Props) {
  const tr = t[locale];
  const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard';

  const [tenantId, setTenantId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [history, setHistory] = useState<Handoff[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [tab, setTab] = useState<Tab>('conversations');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const showThread = selected !== null;
  const activeHandoff = selected
    ? handoffs.find(h => h.whatsapp_number === selected && h.status === 'active')
    : null;

  // Load tenant + messages
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setAccessToken(session.access_token);

      const { data: membership } = await supabase
        .from('tenant_users').select('tenant_id')
        .eq('user_id', session.user.id).limit(1).maybeSingle();

      if (!membership?.tenant_id) { setLoading(false); return; }
      setTenantId(membership.tenant_id);

      const { data } = await supabase
        .from('conversations')
        .select('id, user_number, role, message, metadata, created_at')
        .eq('tenant_id', membership.tenant_id)
        .order('created_at', { ascending: true });

      const rows = (data || []) as Message[];
      setMessages(rows);
      setContacts(buildContacts(rows));

      const params = new URLSearchParams(window.location.search);
      const numberParam = params.get('number');
      if (numberParam) setSelected(numberParam);

      setLoading(false);
    };
    load();
  }, []);

  // Load active handoffs + history + stats
  useEffect(() => {
    if (!accessToken) return;
    const headers = { Authorization: `Bearer ${accessToken}` };
    fetch(`${API_BASE}/api/handoffs/`, { headers }).then(r => r.ok ? r.json() : []).then(setHandoffs);
    fetch(`${API_BASE}/api/handoffs/history`, { headers }).then(r => r.ok ? r.json() : []).then(setHistory);
    fetch(`${API_BASE}/api/handoffs/stats`, { headers }).then(r => r.ok ? r.json() : null).then(setStats);
  }, [accessToken]);

  // Realtime: conversations
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel('conv-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          const next = [...prev, msg];
          setContacts(buildContacts(next));
          return next;
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId]);

  // Realtime: handoffs
  useEffect(() => {
    if (!tenantId) return;
    const ch = supabase.channel('handoffs-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'active_handoffs', filter: `tenant_id=eq.${tenantId}` }, (payload) => {
        const h = payload.new as Handoff;
        if (payload.eventType === 'INSERT' && h.status === 'active') {
          setHandoffs(prev => [h, ...prev.filter(x => x.id !== h.id)]);
          triggerNotification(tr.newHandoff(h.whatsapp_number), h.whatsapp_number);
        } else if (payload.eventType === 'UPDATE') {
          setHandoffs(prev => prev.map(x => x.id === h.id ? h : x));
          if (h.status !== 'active') {
            setHistory(prev => [h, ...prev.filter(x => x.id !== h.id)]);
            // refresh stats
            if (accessToken) {
              fetch(`${API_BASE}/api/handoffs/stats`, { headers: { Authorization: `Bearer ${accessToken}` } })
                .then(r => r.ok ? r.json() : null).then(setStats);
            }
          }
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [tenantId, accessToken]);

  // Poll during active handoff
  useEffect(() => {
    if (!activeHandoff || !tenantId || !selected) return;
    const poll = async () => {
      const latest = messages.filter(m => m.user_number === selected).at(-1);
      const since = latest?.created_at ?? new Date(0).toISOString();
      const { data } = await supabase
        .from('conversations').select('id, user_number, role, message, metadata, created_at')
        .eq('tenant_id', tenantId).eq('user_number', selected).gt('created_at', since)
        .order('created_at', { ascending: true });
      if (data?.length) {
        setMessages(prev => {
          const ids = new Set(prev.map(m => m.id));
          const fresh = (data as Message[]).filter(m => !ids.has(m.id));
          if (!fresh.length) return prev;
          const next = [...prev, ...fresh];
          setContacts(buildContacts(next));
          return next;
        });
      }
    };
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [activeHandoff?.id, selected, tenantId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected, messages.length]);

  async function sendReply() {
    if (!reply.trim() || !activeHandoff || !accessToken || !selected) return;
    const text = reply.trim();
    setSending(true);
    setReply('');
    try {
      await fetch(`${API_BASE}/api/handoffs/${activeHandoff.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ message: text }),
      });
    } finally {
      setSending(false);
    }
  }

  async function closeHandoff() {
    if (!activeHandoff || !accessToken) return;
    if (!confirm(tr.closeHandoffConfirm)) return;
    await fetch(`${API_BASE}/api/handoffs/${activeHandoff.id}/close`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    setHandoffs(prev => prev.map(h => h.id === activeHandoff.id ? { ...h, status: 'closed' } : h));
  }

  const filtered = search ? contacts.filter(c => c.user_number.includes(search)) : contacts;
  const thread = selected ? messages.filter(m => m.user_number === selected) : [];

  if (loading) {
    return (
      <div class="flex items-center justify-center py-20">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        <span class="ml-3 text-gray-500 dark:text-gray-400">{tr.loading}</span>
      </div>
    );
  }

  return (
    <div class="flex flex-col" style="height: calc(100dvh - 64px)">
      {/* Top bar */}
      <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
        {showThread && tab === 'conversations' ? (
          <button onClick={() => setSelected(null)} class="text-sm text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">{tr.backToList}</button>
        ) : (
          <a href={dashboardPath} class="text-sm text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">{tr.back}</a>
        )}
        <div class="flex-1 min-w-0">
          {showThread && tab === 'conversations' ? (
            <div class="flex items-center gap-2">
              <p class="font-semibold text-sm dark:text-white truncate">+{selected}</p>
              {activeHandoff && (
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full font-medium flex-shrink-0">
                  <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />{tr.handoffBadge}
                </span>
              )}
            </div>
          ) : (
            <h1 class="font-semibold text-base dark:text-white">{tr.title}</h1>
          )}
        </div>
        {showThread && activeHandoff && tab === 'conversations' && (
          <button onClick={closeHandoff} class="flex-shrink-0 px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
            {tr.closeHandoff}
          </button>
        )}
      </div>

      {/* Tabs */}
      {(!showThread || tab !== 'conversations') && (
        <div class="flex border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
          {(['conversations', 'history', 'stats'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSelected(null); }}
              class={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {t === 'conversations' ? tr.tabConversations : t === 'history' ? tr.tabHistory : tr.tabStats}
              {t === 'conversations' && handoffs.length > 0 && (
                <span class="ml-1.5 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full">{handoffs.length}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Body */}
      <div class="flex flex-1 min-h-0 overflow-hidden">

        {/* STATS TAB */}
        {tab === 'stats' && (
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            {!stats ? (
              <p class="text-center text-gray-400 py-12">{tr.loading}</p>
            ) : (
              <>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <StatCard label={tr.statTotal} value={stats.total} />
                  <StatCard label={tr.statActive} value={stats.active} />
                  <StatCard label={tr.statClosed} value={stats.closed} />
                  <StatCard label={tr.statExpired} value={stats.expired} />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <StatCard label={tr.statAvgDuration} value={stats.avg_duration_minutes != null ? tr.minutes(Math.round(stats.avg_duration_minutes)) : '—'} />
                  <StatCard label={tr.statAvgResponse} value={stats.avg_first_response_minutes != null ? tr.minutes(Math.round(stats.avg_first_response_minutes)) : '—'} />
                  <StatCard label={tr.statAvgMessages} value={stats.avg_messages ?? '—'} />
                </div>
                {Object.keys(stats.closed_by).length > 0 && (
                  <div class="bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                    <p class="text-xs text-gray-500 dark:text-gray-400 mb-3">{tr.statClosedBy}</p>
                    <div class="space-y-2">
                      {Object.entries(stats.closed_by).map(([k, v]) => (
                        <div key={k} class="flex items-center gap-2">
                          <span class="text-sm dark:text-white w-28 flex-shrink-0">{tr.closedByLabels[k] ?? k}</span>
                          <div class="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                            <div class="bg-blue-500 h-2 rounded-full" style={`width:${Math.round(v / stats.total * 100)}%`} />
                          </div>
                          <span class="text-sm text-gray-500 dark:text-gray-400 w-6 text-right">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === 'history' && (
          <div class="flex-1 overflow-y-auto">
            {history.length === 0 ? (
              <p class="text-center text-gray-400 dark:text-gray-500 py-12 text-sm">{tr.noHistory}</p>
            ) : (
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-800 sticky top-0">
                  <tr>
                    {['Usuario', 'Estado', 'Duración', 'Mensajes', 'Cerrado por', 'Fecha'].map(h => (
                      <th key={h} class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-gray-700">
                  {history.map(h => (
                    <tr key={h.id} class="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                      <td class="px-4 py-3 font-mono text-xs dark:text-white">+{h.whatsapp_number}</td>
                      <td class="px-4 py-3">
                        <span class={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${h.status === 'closed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'}`}>
                          {h.status === 'closed' ? 'Cerrado' : 'Expirado'}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{tr.duration(h)}</td>
                      <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{h.message_count ?? 0}</td>
                      <td class="px-4 py-3 text-gray-600 dark:text-gray-400">{h.closed_by ? (tr.closedByLabels[h.closed_by] ?? h.closed_by) : '—'}</td>
                      <td class="px-4 py-3 text-gray-400 text-xs">{h.closed_at ? formatTime(h.closed_at, locale) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CONVERSATIONS TAB */}
        {tab === 'conversations' && (
          <>
            {/* Contact list */}
            <div class={`${showThread ? 'hidden md:flex' : 'flex'} w-full md:w-72 lg:w-80 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900`}>
              <div class="p-3 border-b border-gray-200 dark:border-gray-700">
                <input type="text" placeholder={tr.search} value={search}
                  onInput={e => setSearch((e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div class="overflow-y-auto flex-1">
                {contacts.length === 0 ? (
                  <p class="text-center text-sm text-gray-400 dark:text-gray-500 py-12">{tr.noConversations}</p>
                ) : filtered.map(c => {
                  const hasHandoff = handoffs.some(h => h.whatsapp_number === c.user_number && h.status === 'active');
                  return (
                    <button key={c.user_number} onClick={() => setSelected(c.user_number)}
                      class={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-700 transition-colors ${selected === c.user_number ? 'bg-white dark:bg-gray-800 border-l-4 border-l-blue-500' : 'hover:bg-white dark:hover:bg-gray-800'}`}
                    >
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-sm font-medium dark:text-white truncate">+{c.user_number}</span>
                        <div class="flex items-center gap-1.5 flex-shrink-0">
                          {hasHandoff && (
                            <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full font-medium">
                              <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />{tr.handoffBadge}
                            </span>
                          )}
                          <span class="text-xs text-gray-400">{formatTime(c.last_at, locale)}</span>
                        </div>
                      </div>
                      <p class="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{c.last_message}</p>
                      <p class="text-xs text-gray-400 mt-0.5">{tr.messages(c.count)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Thread panel */}
            <div class={`${showThread ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 bg-white dark:bg-gray-900`}>
              {!selected ? (
                <div class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
                  <div class="text-center"><div class="text-4xl mb-3">💬</div><p class="text-sm">{tr.selectContact}</p></div>
                </div>
              ) : (
                <>
                  {activeHandoff && (
                    <div class="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 flex items-center gap-2 flex-shrink-0">
                      <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                      <p class="text-xs text-green-700 dark:text-green-400">{tr.handoffActive}</p>
                    </div>
                  )}
                  <div class="flex-1 overflow-y-auto p-4 space-y-3">
                    {thread.map(msg => {
                      const isUser = msg.role === 'user';
                      const isSystem = msg.role === 'system';
                      const isHumanAgent = msg.role === 'assistant' && (msg.metadata as any)?.source === 'human_agent';
                      const meta = msg.metadata || {};
                      return (
                        <div key={msg.id} class={`flex ${isUser ? 'justify-start' : isSystem ? 'justify-center' : 'justify-end'}`}>
                          {isSystem ? (
                            <div class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-400 text-xs rounded-full max-w-[80%] text-center">{msg.message}</div>
                          ) : (
                            <div class="max-w-[80%]">
                              <div class={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${isUser ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm' : isHumanAgent ? 'bg-green-600 text-white rounded-tr-sm' : 'bg-blue-600 text-white rounded-tr-sm'}`}>
                                {msg.message}
                              </div>
                              <div class={`mt-1 flex flex-wrap gap-1 ${isUser ? '' : 'justify-end'}`}>
                                {(meta as any).confidence != null && <MetaBadge label={tr.confidence} value={(meta as any).confidence} />}
                                {(meta as any).faq_category && <MetaBadge label={tr.category} value={(meta as any).faq_category} />}
                                {(meta as any).method && <MetaBadge label={tr.method} value={(meta as any).method} />}
                              </div>
                              <p class={`text-xs text-gray-400 mt-0.5 ${isUser ? '' : 'text-right'}`}>
                                {isUser ? tr.customer : isHumanAgent ? tr.agent : tr.you} · {formatFull(msg.created_at, locale)}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    <div ref={threadEndRef} />
                  </div>
                  {activeHandoff && (
                    <div class="px-3 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
                      <div class="flex items-end gap-2">
                        <input type="text" value={reply}
                          onInput={e => setReply((e.target as HTMLInputElement).value)}
                          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                          placeholder={tr.replyPlaceholder} disabled={sending}
                          class="flex-1 px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                        />
                        <button onClick={sendReply} disabled={sending || !reply.trim()}
                          class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {sending ? (
                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
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
