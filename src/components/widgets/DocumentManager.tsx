import { useState, useEffect } from 'preact/hooks';
import { supabase } from '~/lib/supabase';
import AuthGuard from './AuthGuard';

interface Props {
  apiUrl: string;
  locale?: 'es' | 'en';
}

interface Document {
  id: string;
  title: string;
  content: string;
  file_type?: string;
  created_at?: string;
  total_chunks?: number;
}

const translations = {
  es: {
    title: 'Base de Conocimiento',
    subtitle: 'Sube documentos para entrenar tu bot de FAQs',
    addDocument: 'Agregar Documento',
    docTitle: 'Titulo',
    docContent: 'Contenido',
    docTitlePlaceholder: 'Ej: Politica de envios',
    docContentPlaceholder: 'Pega aqui el contenido del documento...',
    save: 'Guardar',
    saving: 'Guardando...',
    delete: 'Eliminar',
    deleting: 'Eliminando...',
    noDocuments: 'No hay documentos aun. Agrega uno para entrenar tu bot.',
    chunks: 'partes',
    confirmDelete: 'Eliminar este documento?',
    created: 'Documento creado correctamente',
    deleted: 'Documento eliminado',
    errorCreate: 'Error al crear el documento',
    errorLoad: 'Error al cargar documentos',
    errorDelete: 'Error al eliminar el documento',
    back: 'Volver al panel',
  },
  en: {
    title: 'Knowledge Base',
    subtitle: 'Upload documents to train your FAQ bot',
    addDocument: 'Add Document',
    docTitle: 'Title',
    docContent: 'Content',
    docTitlePlaceholder: 'E.g.: Shipping policy',
    docContentPlaceholder: 'Paste the document content here...',
    save: 'Save',
    saving: 'Saving...',
    delete: 'Delete',
    deleting: 'Deleting...',
    noDocuments: 'No documents yet. Add one to train your bot.',
    chunks: 'parts',
    confirmDelete: 'Delete this document?',
    created: 'Document created successfully',
    deleted: 'Document deleted',
    errorCreate: 'Failed to create document',
    errorLoad: 'Failed to load documents',
    errorDelete: 'Failed to delete document',
    back: 'Back to dashboard',
  },
};

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

function DocumentManagerContent({ apiUrl, locale = 'es' }: Props) {
  const t = translations[locale];
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [saving, setSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadDocuments = async () => {
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${apiUrl}/api/documents`, { headers });
      if (!resp.ok) throw new Error(`${resp.status}`);
      const data = await resp.json();
      setDocuments(data);
    } catch {
      showFeedback('error', t.errorLoad);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const handleCreate = async (e: Event) => {
    e.preventDefault();
    if (!docTitle.trim() || !docContent.trim()) return;

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${apiUrl}/api/documents`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ title: docTitle.trim(), content: docContent.trim() }),
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      showFeedback('success', t.created);
      setDocTitle('');
      setDocContent('');
      setShowForm(false);
      await loadDocuments();
    } catch {
      showFeedback('error', t.errorCreate);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (doc: Document) => {
    if (!confirm(t.confirmDelete)) return;
    setDeletingId(doc.id);
    try {
      const headers = await getAuthHeaders();
      const resp = await fetch(`${apiUrl}/api/documents/${doc.id}`, {
        method: 'DELETE',
        headers,
      });
      if (!resp.ok) throw new Error(`${resp.status}`);
      showFeedback('success', t.deleted);
      await loadDocuments();
    } catch {
      showFeedback('error', t.errorDelete);
    } finally {
      setDeletingId(null);
    }
  };

  const dashboardPath = locale === 'en' ? '/en/dashboard' : '/dashboard';

  return (
    <div>
      <div class="flex items-center justify-between mb-6">
        <div>
          <h2 class="text-2xl font-bold dark:text-white">{t.title}</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400">{t.subtitle}</p>
        </div>
        <div class="flex gap-3">
          <a
            href={dashboardPath}
            class="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50 dark:text-gray-400 dark:border-gray-600 dark:hover:bg-gray-800 transition-colors"
          >
            {t.back}
          </a>
          <button
            onClick={() => setShowForm(!showForm)}
            class="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            {showForm ? '✕' : `+ ${t.addDocument}`}
          </button>
        </div>
      </div>

      {feedback && (
        <div
          class={`mb-4 p-3 rounded text-sm ${
            feedback.type === 'success'
              ? 'bg-green-100 text-green-700 border border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800'
              : 'bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
          }`}
        >
          {feedback.message}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} class="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="docTitle">
              {t.docTitle}
            </label>
            <input
              id="docTitle"
              type="text"
              required
              value={docTitle}
              onInput={(e) => setDocTitle((e.target as HTMLInputElement).value)}
              placeholder={t.docTitlePlaceholder}
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            />
          </div>
          <div class="mb-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1" htmlFor="docContent">
              {t.docContent}
            </label>
            <textarea
              id="docContent"
              required
              rows={8}
              value={docContent}
              onInput={(e) => setDocContent((e.target as HTMLTextAreaElement).value)}
              placeholder={t.docContentPlaceholder}
              class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm"
            />
            <p class="mt-1 text-xs text-gray-400">
              {docContent.length.toLocaleString()} {locale === 'en' ? 'characters' : 'caracteres'}
            </p>
          </div>
          <button
            type="submit"
            disabled={saving}
            class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t.saving : t.save}
          </button>
        </form>
      )}

      {loading ? (
        <div class="flex items-center justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : documents.length === 0 ? (
        <div class="text-center py-12 text-gray-500 dark:text-gray-400">
          <div class="text-4xl mb-3">📄</div>
          <p>{t.noDocuments}</p>
        </div>
      ) : (
        <div class="space-y-3">
          {documents.map((doc) => (
            <div
              key={doc.id}
              class="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 flex items-start justify-between gap-4"
            >
              <div class="flex-1 min-w-0">
                <h3 class="font-medium dark:text-white truncate">{doc.title}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{doc.content}</p>
                <div class="flex gap-3 mt-2 text-xs text-gray-400">
                  {doc.total_chunks && doc.total_chunks > 1 && (
                    <span>
                      {doc.total_chunks} {t.chunks}
                    </span>
                  )}
                  {doc.created_at && <span>{new Date(doc.created_at).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CL')}</span>}
                </div>
              </div>
              <button
                onClick={() => handleDelete(doc)}
                disabled={deletingId === doc.id}
                class="px-3 py-1 text-sm text-red-600 border border-red-300 rounded hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-900/20 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {deletingId === doc.id ? t.deleting : t.delete}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DocumentManager({ apiUrl, locale = 'es' }: Props) {
  return (
    <AuthGuard locale={locale}>
      <DocumentManagerContent apiUrl={apiUrl} locale={locale} />
    </AuthGuard>
  );
}
