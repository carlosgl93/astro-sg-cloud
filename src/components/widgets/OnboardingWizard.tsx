import { useEffect, useState } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import AuthGuard from './AuthGuard';
import FacebookSignupButton from './FacebookSignupButton';
import InstagramSignupButton from './InstagramSignupButton';

interface Props {
  apiUrl: string;
  locale?: 'es' | 'en';
  /** When set, wizard acts on behalf of this tenant (backoffice mode) */
  tenantId?: string;
}

interface BotConfig {
  system_prompt: string | null;
  greeting: string | null;
  handoff_trigger: string | null;
}

const t = {
  es: {
    title: 'Configuración del Bot',
    step1: 'Conectar canales',
    step2: 'Documentos',
    step3: 'Bot',
    step4: 'Listo',
    next: 'Siguiente',
    back: 'Atrás',
    save: 'Guardar',
    saving: 'Guardando...',
    saved: 'Guardado',
    connectWa: 'Conectar WhatsApp Business',
    connectWaDesc: 'Vincula tu número de WhatsApp Business para comenzar a recibir mensajes.',
    connectBtn: 'Conectar con Facebook',
    alreadyConnected: '✓ WhatsApp conectado',
    connectIg: 'Conectar Instagram',
    connectIgDesc: 'Vincula tu cuenta profesional de Instagram para responder mensajes directos.',
    igConnected: '✓ Instagram conectado',
    channelSkip: 'Puedes conectar uno o ambos canales ahora. Tambien puedes hacerlo despues desde el panel.',
    docsTitle: 'Base de conocimiento',
    docsDesc: 'Sube documentos con preguntas frecuentes, políticas o información de tu negocio. El bot los usará para responder a tus clientes.',
    goToDocs: 'Ir a Documentos →',
    botTitle: 'Configurar el bot',
    systemPromptLabel: 'Instrucción del sistema (system prompt)',
    systemPromptPlaceholder: 'Eres un asistente amable de [Nombre de tu negocio]. Ayudas a los clientes con preguntas sobre nuestros productos y servicios...',
    greetingLabel: 'Mensaje de bienvenida',
    greetingPlaceholder: '¡Hola! Soy el asistente virtual de [Tu negocio]. ¿En qué puedo ayudarte hoy?',
    handoffLabel: 'Frase para transferir a humano',
    handoffPlaceholder: 'hablar con una persona, agente, humano',
    handoffHint: 'Si el cliente escribe algo similar, el bot transferirá la conversación a un agente.',
    doneTitle: '¡Todo listo!',
    doneDesc: 'Tu bot está configurado y listo para responder mensajes de WhatsApp.',
    goToConversations: 'Ver conversaciones →',
    goToDashboard: '← Volver al panel',
    error: 'Error al guardar. Intenta de nuevo.',
  },
  en: {
    title: 'Bot Setup',
    step1: 'Connect channels',
    step2: 'Documents',
    step3: 'Bot',
    step4: 'Done',
    next: 'Next',
    back: 'Back',
    save: 'Save',
    saving: 'Saving...',
    saved: 'Saved',
    connectWa: 'Connect WhatsApp Business',
    connectWaDesc: 'Link your WhatsApp Business number to start receiving messages.',
    connectBtn: 'Connect with Facebook',
    alreadyConnected: '✓ WhatsApp connected',
    connectIg: 'Connect Instagram',
    connectIgDesc: 'Link your Instagram Professional account to reply to direct messages.',
    igConnected: '✓ Instagram connected',
    channelSkip: 'You can connect one or both channels now. You can also do it later from the dashboard.',
    docsTitle: 'Knowledge base',
    docsDesc: 'Upload documents with FAQs, policies, or business info. The bot will use these to answer your customers.',
    goToDocs: 'Go to Documents →',
    botTitle: 'Configure the bot',
    systemPromptLabel: 'System prompt',
    systemPromptPlaceholder: 'You are a friendly assistant for [Business Name]. You help customers with questions about our products and services...',
    greetingLabel: 'Welcome message',
    greetingPlaceholder: 'Hi! I\'m the virtual assistant for [Your Business]. How can I help you today?',
    handoffLabel: 'Human handoff phrase',
    handoffPlaceholder: 'talk to a person, agent, human',
    handoffHint: 'If the customer writes something similar, the bot will transfer the conversation to a human agent.',
    doneTitle: 'All set!',
    doneDesc: 'Your bot is configured and ready to respond to WhatsApp messages.',
    goToConversations: 'View conversations →',
    goToDashboard: '← Back to dashboard',
    error: 'Error saving. Please try again.',
  },
};

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div class="flex flex-col items-center gap-1">
      <div
        class={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
          ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'}`}
      >
        {done ? '✓' : n}
      </div>
      <span class={`text-xs ${active ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

function WizardContent({ apiUrl, locale = 'es', tenantId }: Props) {
  const tr = t[locale];
  const [step, setStep] = useState(1);
  const [waConnected, setWaConnected] = useState(false);
  const [igConnected, setIgConnected] = useState(false);
  const [config, setConfig] = useState<BotConfig>({ system_prompt: null, greeting: null, handoff_trigger: null });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

      // Check WhatsApp + Instagram connection
      try {
        const meResp = await fetch(`${apiUrl}/api/tenants/me`, { headers });
        if (meResp.ok) {
          const d = await meResp.json();
          setWaConnected(!!d.whatsapp_connected);
          setIgConnected(!!d.instagram_connected);
        }
      } catch (_) {}

      // Load existing bot config
      try {
        const cfgResp = await fetch(`${apiUrl}/api/tenants/config`, { headers });
        if (cfgResp.ok) {
          const data = await cfgResp.json();
          setConfig({
            system_prompt: data.system_prompt || '',
            greeting: data.greeting || '',
            handoff_trigger: data.handoff_trigger || '',
          });
        }
      } catch (_) {}

      setLoading(false);
    };
    load();
  }, [apiUrl]);

  const saveBotConfig = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`;

    try {
      const resp = await fetch(`${apiUrl}/api/tenants/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(config),
      });
      if (!resp.ok) throw new Error(await resp.text());
      setSaveSuccess(true);
      setTimeout(() => setStep(4), 600);
    } catch (_) {
      setSaveError(tr.error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div class="flex justify-center p-12 text-gray-400">Cargando...</div>;
  }

  const fbConfigId = import.meta.env.PUBLIC_FACEBOOK_CONFIG_ID || '';
  const rawIgConfigId = import.meta.env.PUBLIC_INSTAGRAM_CONFIG_ID || '';
  const igConfigId =
    rawIgConfigId || import.meta.env.PUBLIC_FACEBOOK_CONFIG_ID || '';
  if (!rawIgConfigId) {
    // Surfaced in dev console so missing PUBLIC_INSTAGRAM_CONFIG_ID is visible
    // instead of silently using the WA config.
    // eslint-disable-next-line no-console
    console.warn(
      '[OnboardingWizard] PUBLIC_INSTAGRAM_CONFIG_ID is unset; falling back to PUBLIC_FACEBOOK_CONFIG_ID. Set it explicitly in .env to use a dedicated IG config.'
    );
  }

  return (
    <div class="max-w-2xl mx-auto px-4 py-8">
      <h1 class="text-2xl font-bold mb-8 dark:text-white">{tr.title}</h1>

      {/* Stepper */}
      <div class="flex items-center justify-between mb-10 relative">
        <div class="absolute top-4 left-0 right-0 h-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
        <Step n={1} label={tr.step1} active={step === 1} done={step > 1} />
        <Step n={2} label={tr.step2} active={step === 2} done={step > 2} />
        <Step n={3} label={tr.step3} active={step === 3} done={step > 3} />
        <Step n={4} label={tr.step4} active={step === 4} done={false} />
      </div>

      {/* Step 1 — Connect channels (WhatsApp + Instagram) */}
      {step === 1 && (
        <div class="space-y-6">
          <h2 class="text-xl font-semibold dark:text-white">{tr.connectWa}</h2>
          <p class="text-gray-600 dark:text-gray-400">{tr.connectWaDesc}</p>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* WhatsApp card */}
            <div class="p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold dark:text-white">WhatsApp</h3>
                {waConnected && (
                  <span class="text-xs font-semibold text-green-700 dark:text-green-400 inline-flex items-center gap-1">
                    <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clip-rule="evenodd"/>
                    </svg>
                    {tr.alreadyConnected}
                  </span>
                )}
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{tr.connectWaDesc}</p>
              {waConnected ? (
                <div class="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium">
                  {tr.alreadyConnected}
                </div>
              ) : (
                <FacebookSignupButton configId={fbConfigId} locale={locale} />
              )}
            </div>

            {/* Instagram card */}
            <div class="p-5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 space-y-3">
              <div class="flex items-center justify-between">
                <h3 class="text-base font-semibold dark:text-white">Instagram</h3>
                {igConnected && (
                  <span class="text-xs font-semibold text-green-700 dark:text-green-400 inline-flex items-center gap-1">
                    <svg class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.5 7.5a1 1 0 01-1.4 0L3.3 9.7a1 1 0 011.4-1.4L8.5 12l6.8-6.7a1 1 0 011.4 0z" clip-rule="evenodd"/>
                    </svg>
                    {tr.igConnected}
                  </span>
                )}
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">{tr.connectIgDesc}</p>
              {igConnected ? (
                <div class="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-medium">
                  {tr.igConnected}
                </div>
              ) : (
                <InstagramSignupButton configId={igConfigId} locale={locale} />
              )}
            </div>
          </div>

          <p class="text-xs text-gray-500 dark:text-gray-400">{tr.channelSkip}</p>

          <div class="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {tr.next} →
            </button>
          </div>
        </div>
      )}

      {/* Step 2 — Documents */}
      {step === 2 && (
        <div class="space-y-6">
          <h2 class="text-xl font-semibold dark:text-white">{tr.docsTitle}</h2>
          <p class="text-gray-600 dark:text-gray-400">{tr.docsDesc}</p>
          <a
            href="/documents"
            class="inline-flex items-center gap-2 px-5 py-3 border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg font-medium transition-colors"
          >
            {tr.goToDocs}
          </a>
          <div class="flex justify-between pt-4">
            <button onClick={() => setStep(1)} class="px-5 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              ← {tr.back}
            </button>
            <button
              onClick={() => setStep(3)}
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {tr.next} →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Bot config */}
      {step === 3 && (
        <div class="space-y-6">
          <h2 class="text-xl font-semibold dark:text-white">{tr.botTitle}</h2>

          <div class="space-y-1">
            <label class="block text-sm font-medium dark:text-gray-300">{tr.systemPromptLabel}</label>
            <textarea
              rows={5}
              value={config.system_prompt || ''}
              onInput={(e) => setConfig({ ...config, system_prompt: (e.target as HTMLTextAreaElement).value })}
              placeholder={tr.systemPromptPlaceholder}
              class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-sm font-medium dark:text-gray-300">{tr.greetingLabel}</label>
            <textarea
              rows={3}
              value={config.greeting || ''}
              onInput={(e) => setConfig({ ...config, greeting: (e.target as HTMLTextAreaElement).value })}
              placeholder={tr.greetingPlaceholder}
              class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none resize-none"
            />
          </div>

          <div class="space-y-1">
            <label class="block text-sm font-medium dark:text-gray-300">{tr.handoffLabel}</label>
            <input
              type="text"
              value={config.handoff_trigger || ''}
              onInput={(e) => setConfig({ ...config, handoff_trigger: (e.target as HTMLInputElement).value })}
              placeholder={tr.handoffPlaceholder}
              class="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p class="text-xs text-gray-400">{tr.handoffHint}</p>
          </div>

          {saveError && <p class="text-sm text-red-500">{saveError}</p>}

          <div class="flex justify-between pt-4">
            <button onClick={() => setStep(2)} class="px-5 py-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
              ← {tr.back}
            </button>
            <button
              onClick={saveBotConfig}
              disabled={saving}
              class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? tr.saving : saveSuccess ? tr.saved : tr.save}
            </button>
          </div>
        </div>
      )}

      {/* Step 4 — Done */}
      {step === 4 && (
        <div class="space-y-6 text-center">
          <div class="text-6xl">🎉</div>
          <h2 class="text-2xl font-bold dark:text-white">{tr.doneTitle}</h2>
          <p class="text-gray-600 dark:text-gray-400">{tr.doneDesc}</p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center pt-4">
            <a
              href="/conversations"
              class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {tr.goToConversations}
            </a>
            <a
              href="/dashboard"
              class="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg font-medium transition-colors"
            >
              {tr.goToDashboard}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnboardingWizard({ apiUrl, locale = 'es', tenantId }: Props) {
  return (
    <AuthGuard locale={locale}>
      <WizardContent apiUrl={apiUrl} locale={locale} tenantId={tenantId} />
    </AuthGuard>
  );
}
