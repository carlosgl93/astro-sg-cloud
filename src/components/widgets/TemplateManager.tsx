import { useState, useEffect } from 'preact/hooks';
import type { FunctionalComponent } from 'preact';

interface Template {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  components: unknown[];
}

interface TemplateManagerProps {
  apiUrl: string;
}

type FeedbackState = { type: 'success' | 'error'; message: string } | null;

const TemplateManager: FunctionalComponent<TemplateManagerProps> = ({ apiUrl }) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createCategory, setCreateCategory] = useState('MARKETING');
  const [createLanguage, setCreateLanguage] = useState('es');
  const [createBody, setCreateBody] = useState('');
  const [createHeader, setCreateHeader] = useState('');
  const [createFooter, setCreateFooter] = useState('');
  const [creating, setCreating] = useState(false);

  // Send form state
  const [sendTemplate, setSendTemplate] = useState('');
  const [sendPhone, setSendPhone] = useState('');
  const [sendLanguage, setSendLanguage] = useState('es');

  const handleTemplateSelect = (name: string) => {
    setSendTemplate(name);
    const tpl = templates.find((t) => t.name === name);
    if (tpl) setSendLanguage(tpl.language);
  };
  const [sending, setSending] = useState(false);
  const [sendFeedback, setSendFeedback] = useState<FeedbackState>(null);

  const fetchTemplates = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(`${apiUrl}/templates`);
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      const json = await res.json();
      setTemplates(json.data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch templates';
      setFeedback({ type: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDelete = async (name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      const res = await fetch(`${apiUrl}/templates/${name}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
      setFeedback({ type: 'success', message: `Template "${name}" deleted successfully.` });
      fetchTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete template';
      setFeedback({ type: 'error', message });
    }
  };

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    setCreating(true);
    setFeedback(null);
    try {
      const components: { type: string; text: string }[] = [];
      if (createHeader.trim()) {
        components.push({ type: 'HEADER', format: 'TEXT', text: createHeader.trim() });
      }
      components.push({ type: 'BODY', text: createBody.trim() });
      if (createFooter.trim()) {
        components.push({ type: 'FOOTER', text: createFooter.trim() });
      }

      const res = await fetch(`${apiUrl}/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createName.trim().toLowerCase().replace(/\s+/g, '_'),
          language: createLanguage,
          category: createCategory,
          components,
        }),
      });
      if (!res.ok) {
        const errBody = await res.text();
        throw new Error(`Error ${res.status}: ${errBody}`);
      }
      setFeedback({ type: 'success', message: 'Template created successfully!' });
      setCreateName('');
      setCreateBody('');
      setCreateHeader('');
      setCreateFooter('');
      fetchTemplates();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create template';
      setFeedback({ type: 'error', message });
    } finally {
      setCreating(false);
    }
  };

  const handleSend = async (e: Event) => {
    e.preventDefault();
    setSending(true);
    setSendFeedback(null);
    try {
      let res: Response;
      try {
        res = await fetch(`${apiUrl}/templates/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: sendPhone.trim(),
            template_name: sendTemplate,
            language: sendLanguage,
            components: [],
          }),
        });
      } catch {
        throw new Error('Could not reach the backend. Check that it is running and CORS is configured.');
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.detail;
        const metaMsg = typeof detail === 'object' ? detail?.error?.error_user_msg || detail?.error?.message : detail;
        throw new Error(metaMsg || `Error ${res.status}: ${res.statusText}`);
      }
      setSendFeedback({ type: 'success', message: `Message sent successfully! ${data?.messages?.[0]?.id ? `ID: ${data.messages[0].id}` : ''}` });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setSendFeedback({ type: 'error', message });
    } finally {
      setSending(false);
    }
  };

  const statusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'APPROVED') return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    if (s === 'PENDING') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    if (s === 'REJECTED') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent';

  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1';

  return (
    <div class="space-y-10">
      {/* Feedback banner */}
      {feedback && (
        <div
          class={`p-4 rounded-lg text-sm ${
            feedback.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Template List ── */}
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white">Templates</h2>
          <button
            onClick={fetchTemplates}
            disabled={loading}
            class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {templates.length === 0 && !loading ? (
          <p class="text-gray-500 dark:text-gray-400 text-center py-8">No templates found. Create one below.</p>
        ) : (
          <div class="overflow-x-auto">
            <table class="w-full text-sm text-left">
              <thead class="text-xs uppercase bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-400">
                <tr>
                  <th class="px-4 py-3">Name</th>
                  <th class="px-4 py-3">Status</th>
                  <th class="px-4 py-3">Category</th>
                  <th class="px-4 py-3">Language</th>
                  <th class="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                {templates.map((t) => (
                  <tr key={t.id || t.name} class="hover:bg-gray-50 dark:hover:bg-slate-800/50">
                    <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{t.name}</td>
                    <td class="px-4 py-3">
                      <span class={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${statusBadge(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{t.category}</td>
                    <td class="px-4 py-3 text-gray-600 dark:text-gray-300">{t.language}</td>
                    <td class="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(t.name)}
                        class="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 font-medium text-sm"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Create Template ── */}
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-6">Create Template</h2>
        <form onSubmit={handleCreate} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class={labelClass}>Template Name</label>
              <input
                type="text"
                value={createName}
                onInput={(e) => setCreateName((e.target as HTMLInputElement).value)}
                placeholder="my_template_name"
                required
                pattern="[a-z0-9_]+"
                title="Lowercase letters, numbers, and underscores only"
                class={inputClass}
              />
            </div>
            <div>
              <label class={labelClass}>Category</label>
              <select value={createCategory} onChange={(e) => setCreateCategory((e.target as HTMLSelectElement).value)} class={inputClass}>
                <option value="MARKETING">MARKETING</option>
                <option value="UTILITY">UTILITY</option>
                <option value="AUTHENTICATION">AUTHENTICATION</option>
              </select>
            </div>
            <div>
              <label class={labelClass}>Language</label>
              <select value={createLanguage} onChange={(e) => setCreateLanguage((e.target as HTMLSelectElement).value)} class={inputClass}>
                <optgroup label="Spanish">
                  <option value="es">es — Spanish (Chile / generic)</option>
                  <option value="es_AR">es_AR — Spanish (Argentina)</option>
                  <option value="es_MX">es_MX — Spanish (Mexico)</option>
                  <option value="es_ES">es_ES — Spanish (Spain)</option>
                </optgroup>
                <optgroup label="English">
                  <option value="en_US">en_US — English (US)</option>
                  <option value="en_GB">en_GB — English (UK)</option>
                </optgroup>
                <optgroup label="Portuguese">
                  <option value="pt_BR">pt_BR — Portuguese (Brazil)</option>
                  <option value="pt_PT">pt_PT — Portuguese (Portugal)</option>
                </optgroup>
              </select>
            </div>
          </div>

          <div>
            <label class={labelClass}>Header Text (optional)</label>
            <input
              type="text"
              value={createHeader}
              onInput={(e) => setCreateHeader((e.target as HTMLInputElement).value)}
              placeholder="Header text"
              class={inputClass}
            />
          </div>

          <div>
            <label class={labelClass}>Body Text</label>
            <textarea
              value={createBody}
              onInput={(e) => setCreateBody((e.target as HTMLTextAreaElement).value)}
              placeholder="Hello {{1}}, your order {{2}} is ready."
              required
              rows={4}
              class={inputClass}
            />
            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Use {'{{1}}'}, {'{{2}}'}, etc. for variable placeholders.
            </p>
          </div>

          <div>
            <label class={labelClass}>Footer Text (optional)</label>
            <input
              type="text"
              value={createFooter}
              onInput={(e) => setCreateFooter((e.target as HTMLInputElement).value)}
              placeholder="Footer text"
              class={inputClass}
            />
          </div>

          <button
            type="submit"
            disabled={creating}
            class="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-gray-400 rounded-lg transition-colors"
          >
            {creating ? 'Creating...' : 'Create Template'}
          </button>
        </form>
      </div>

      {/* ── Send Test Message ── */}
      <div class="bg-white dark:bg-slate-900 rounded-xl shadow-lg p-6">
        <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-6">Send Test Message</h2>

        {sendFeedback && (
          <div
            class={`p-4 rounded-lg text-sm mb-4 ${
              sendFeedback.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            }`}
          >
            {sendFeedback.message}
          </div>
        )}

        <form onSubmit={handleSend} class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class={labelClass}>Template</label>
              <select
                value={sendTemplate}
                onChange={(e) => handleTemplateSelect((e.target as HTMLSelectElement).value)}
                required
                class={inputClass}
              >
                <option value="" disabled>
                  Select a template
                </option>
                {templates.map((t) => (
                  <option key={t.id || t.name} value={t.name}>
                    {t.name} ({t.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label class={labelClass}>Phone Number</label>
              <input
                type="text"
                value={sendPhone}
                onInput={(e) => setSendPhone((e.target as HTMLInputElement).value)}
                placeholder="56912345678"
                required
                class={inputClass}
              />
            </div>
            <div>
              <label class={labelClass}>Language</label>
              <input
                type="text"
                value={sendLanguage}
                onInput={(e) => setSendLanguage((e.target as HTMLInputElement).value)}
                placeholder="es"
                class={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={sending || !sendTemplate}
            class="inline-flex items-center px-6 py-3 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 rounded-lg transition-colors"
          >
            {sending ? 'Sending...' : 'Send Test Message'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TemplateManager;
