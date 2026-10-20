import { useEffect, useState } from 'preact/hooks';

interface QueueMetrics {
  messages_sent: number;
  messages_failed: number;
  queue_high: number;
  queue_normal: number;
  queue_low: number;
  dead_letter_count: number;
  error?: string;
}

interface Props {
  apiUrl: string;
  locale?: 'es' | 'en';
}

const translations = {
  es: {
    title: 'Cola de Mensajes',
    subtitle: 'Estado del procesamiento asíncrono',
    sent: 'Enviados',
    failed: 'Fallidos',
    highPriority: 'Prioridad Alta',
    normalPriority: 'Prioridad Normal',
    lowPriority: 'Prioridad Baja',
    deadLetter: 'Cola de Fallidos',
    noQueue: 'Cola de mensajes no configurada',
    refresh: 'Actualizar',
    loading: 'Cargando...',
    error: 'Error al cargar métricas',
  },
  en: {
    title: 'Message Queue',
    subtitle: 'Async processing status',
    sent: 'Sent',
    failed: 'Failed',
    highPriority: 'High Priority',
    normalPriority: 'Normal Priority',
    lowPriority: 'Low Priority',
    deadLetter: 'Dead Letter Queue',
    noQueue: 'Message queue not configured',
    refresh: 'Refresh',
    loading: 'Loading...',
    error: 'Error loading metrics',
  },
};

export default function QueueMetrics({ apiUrl, locale = 'es' }: Props) {
  const t = translations[locale];
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch(`${apiUrl}/admin/queue/metrics`);
      if (resp.ok) {
        const data = await resp.json();
        setMetrics(data);
      } else {
        setError(`HTTP ${resp.status}`);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchMetrics, 30000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  if (loading && !metrics) {
    return (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">{t.title}</h3>
        <p class="text-gray-500">{t.loading}</p>
      </div>
    );
  }

  if (error && !metrics) {
    return (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">{t.title}</h3>
        <p class="text-red-500">
          {t.error}: {error}
        </p>
        <button onClick={fetchMetrics} class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          {t.refresh}
        </button>
      </div>
    );
  }

  if (!metrics || metrics.error) {
    return (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">{t.title}</h3>
        <p class="text-gray-500">{t.noQueue}</p>
      </div>
    );
  }

  const totalQueue = metrics.queue_high + metrics.queue_normal + metrics.queue_low;

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-lg font-semibold">{t.title}</h3>
          <p class="text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <button
          onClick={fetchMetrics}
          class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          disabled={loading}
        >
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {/* Queue Status Cards */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <MetricCard label={t.highPriority} value={metrics.queue_high} color="red" />
        <MetricCard label={t.normalPriority} value={metrics.queue_normal} color="yellow" />
        <MetricCard label={t.lowPriority} value={metrics.queue_low} color="green" />
        <MetricCard label={t.deadLetter} value={metrics.dead_letter_count} color="purple" />
      </div>

      {/* Overall Stats */}
      <div class="border-t border-gray-200 dark:border-gray-700 pt-4">
        <div class="flex justify-between text-sm">
          <span class="text-gray-500">
            {t.sent}: <strong class="text-green-600">{metrics.messages_sent}</strong>
          </span>
          <span class="text-gray-500">
            {t.failed}: <strong class="text-red-600">{metrics.messages_failed}</strong>
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      {totalQueue > 0 && (
        <div class="mt-4">
          <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div class="h-full flex">
              {metrics.queue_high > 0 && (
                <div class="bg-red-500" style={{ width: `${(metrics.queue_high / totalQueue) * 100}%` }} />
              )}
              {metrics.queue_normal > 0 && (
                <div class="bg-yellow-500" style={{ width: `${(metrics.queue_normal / totalQueue) * 100}%` }} />
              )}
              {metrics.queue_low > 0 && (
                <div class="bg-green-500" style={{ width: `${(metrics.queue_low / totalQueue) * 100}%` }} />
              )}
            </div>
          </div>
          <p class="text-xs text-gray-400 mt-1">
            {totalQueue} {locale === 'es' ? 'mensajes en cola' : 'messages in queue'}
          </p>
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  color: 'red' | 'yellow' | 'green' | 'purple';
}

function MetricCard({ label, value, color }: MetricCardProps) {
  const colorClasses = {
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    yellow:
      'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    purple:
      'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  };

  return (
    <div class={`p-3 rounded-lg border ${colorClasses[color]}`}>
      <p class="text-xs font-medium opacity-75">{label}</p>
      <p class="text-2xl font-bold">{value}</p>
    </div>
  );
}
