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
}

const API_BASE = import.meta.env.PUBLIC_API_URL || 'https://whatsapp-api-250058155586.us-central1.run.app';

const t = {
  es: {
    title: 'Conversaciones',
    subtitle: 'Conversaciones con clientes',
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
    sending: '...',
    newHandoff: (n: string) => `Nuevo handoff de +${n}`,
  },
  en: {
    title: 'Conversations',
    subtitle: 'Customer conversations',
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
    sending: '...',
    newHandoff: (n: string) => `New handoff from +${n}`,
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
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const threadEndRef = useRef<HTMLDivElement>(null);

  // On mobile, selected contact replaces the list view
  const showThread = selected !== null;

  const activeHandoff = selected
    ? handoffs.find(h => h.whatsapp_number === selected && h.status === 'active')
    : null;

  // Load tenant + messages + read ?number= param
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      setAccessToken(session.access_token);

      const { data: membership } = await supabase
        .from('tenant_users')
        .select('tenant_id')
        .eq('user_id', session.user.id)
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
      setContacts(buildContacts(rows));

      // Auto-select from ?number= URL param (deep link from Telegram)
      const params = new URLSearchParams(window.location.search);
      const numberParam = params.get('number');
      if (numberParam) setSelected(numberParam);

      setLoading(false);
    };
    load();
  }, []);

  // Load active handoffs
  useEffect(() => {
    if (!tenantId || !accessToken) return;
    fetch(`${API_BASE}/api/handoffs/`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    }).then(r => r.ok ? r.json() : []).then(setHandoffs);
  }, [tenantId, accessToken]);

  // Realtime: new messages
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel('conversations-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'conversations',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        const msg = payload.new as Message;
        setMessages(prev => {
          const next = [...prev, msg];
          setContacts(buildContacts(next));
          return next;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  // Realtime: handoffs — notify + update state
  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel('handoffs-rt')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'active_handoffs',
        filter: `tenant_id=eq.${tenantId}`,
      }, (payload) => {
        const h = payload.new as Handoff;
        if (payload.eventType === 'INSERT' && h.status === 'active') {
          setHandoffs(prev => [h, ...prev.filter(x => x.id !== h.id)]);
          triggerNotification(tr.newHandoff(h.whatsapp_number), h.whatsapp_number);
        } else if (payload.eventType === 'UPDATE') {
          setHandoffs(prev => prev.map(x => x.id === h.id ? h : x));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tenantId]);

  // Scroll to bottom on thread change
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selected, messages.length]);

  async function sendReply() {
    if (!reply.trim() || !activeHandoff || !accessToken) return;
    setSending(true);
    try {
      const res = await fetch(`${API_BASE}/api/handoffs/${activeHandoff.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ message: reply.trim() }),
      });
      if (res.ok) setReply('');
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
        {showThread ? (
          <button
            onClick={() => setSelected(null)}
            class="text-sm text-blue-600 dark:text-blue-400 font-medium flex-shrink-0"
          >
            {tr.backToList}
          </button>
        ) : (
          <a href={dashboardPath} class="text-sm text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">
            {tr.back}
          </a>
        )}
        <div class="flex-1 min-w-0">
          {showThread ? (
            <div class="flex items-center gap-2">
              <p class="font-semibold text-sm dark:text-white truncate">+{selected}</p>
              {activeHandoff && (
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full font-medium flex-shrink-0">
                  <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {tr.handoffBadge}
                </span>
              )}
            </div>
          ) : (
            <h1 class="font-semibold text-base dark:text-white">{tr.title}</h1>
          )}
        </div>
        {showThread && activeHandoff && (
          <button
            onClick={closeHandoff}
            class="flex-shrink-0 px-3 py-1.5 text-xs bg-red-50 text-red-600 border border-red-200 rounded-lg dark:bg-red-900/20 dark:text-red-400 dark:border-red-800"
          >
            {tr.closeHandoff}
          </button>
        )}
      </div>

      {/* Body */}
      <div class="flex flex-1 min-h-0 overflow-hidden">

        {/* Contact list — hidden on mobile when thread is open */}
        <div class={`${showThread ? 'hidden md:flex' : 'flex'} w-full md:w-72 lg:w-80 flex-shrink-0 flex-col border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900`}>
          <div class="p-3 border-b border-gray-200 dark:border-gray-700">
            <input
              type="text"
              placeholder={tr.search}
              value={search}
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
                <button
                  key={c.user_number}
                  onClick={() => setSelected(c.user_number)}
                  class={`w-full text-left px-4 py-3 border-b border-gray-200 dark:border-gray-700 active:bg-gray-100 dark:active:bg-gray-700 transition-colors ${selected === c.user_number ? 'bg-white dark:bg-gray-800 border-l-4 border-l-blue-500' : 'hover:bg-white dark:hover:bg-gray-800'}`}
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="text-sm font-medium dark:text-white truncate">+{c.user_number}</span>
                    <div class="flex items-center gap-1.5 flex-shrink-0">
                      {hasHandoff && (
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 rounded-full font-medium">
                          <span class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                          {tr.handoffBadge}
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

        {/* Thread panel — full width on mobile */}
        <div class={`${showThread ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 bg-white dark:bg-gray-900`}>
          {!selected ? (
            <div class="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
              <div class="text-center">
                <div class="text-4xl mb-3">💬</div>
                <p class="text-sm">{tr.selectContact}</p>
              </div>
            </div>
          ) : (
            <>
              {/* Handoff banner */}
              {activeHandoff && (
                <div class="px-4 py-2 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 flex items-center gap-2 flex-shrink-0">
                  <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse flex-shrink-0" />
                  <p class="text-xs text-green-700 dark:text-green-400">{tr.handoffActive}</p>
                </div>
              )}

              {/* Messages */}
              <div class="flex-1 overflow-y-auto p-4 space-y-3">
                {thread.map(msg => {
                  const isUser = msg.role === 'user';
                  const isSystem = msg.role === 'system';
                  const isHumanAgent = msg.role === 'assistant' && (msg.metadata as any)?.source === 'human_agent';
                  const meta = msg.metadata || {};

                  return (
                    <div key={msg.id} class={`flex ${isUser ? 'justify-start' : isSystem ? 'justify-center' : 'justify-end'}`}>
                      {isSystem ? (
                        <div class="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-400 text-xs rounded-full max-w-[80%] text-center">
                          {msg.message}
                        </div>
                      ) : (
                        <div class="max-w-[80%]">
                          <div class={`px-3.5 py-2.5 rounded-2xl text-sm whitespace-pre-wrap leading-relaxed ${
                            isUser
                              ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-tl-sm'
                              : isHumanAgent
                                ? 'bg-green-600 text-white rounded-tr-sm'
                                : 'bg-blue-600 text-white rounded-tr-sm'
                          }`}>
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

              {/* Reply input — only during active handoff */}
              {activeHandoff && (
                <div class="px-3 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 flex-shrink-0">
                  <div class="flex items-end gap-2">
                    <input
                      type="text"
                      value={reply}
                      onInput={e => setReply((e.target as HTMLInputElement).value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                      placeholder={tr.replyPlaceholder}
                      disabled={sending}
                      class="flex-1 px-3 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                    />
                    <button
                      onClick={sendReply}
                      disabled={sending || !reply.trim()}
                      class="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-green-600 text-white rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      aria-label={tr.send}
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
