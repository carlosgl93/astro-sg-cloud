import { useEffect, useState } from 'preact/hooks';

interface TelemetryData {
  messages_received: number;
  messages_sent: number;
  avg_latency_ms: number;
  avg_confidence: number;
  error_rate: number;
  period: string;
}

interface Props {
  apiUrl: string;
  locale?: 'es' | 'en';
}

const translations = {
  es: {
    title: 'Métricas de Telemetry',
    subtitle: 'Rendimiento del bot y estadísticas',
    received: 'Mensajes Recibidos',
    sent: 'Mensajes Enviados',
    latency: 'Latencia Promedio',
    confidence: 'Confianza Promedio',
    errorRate: 'Tasa de Errores',
    noData: 'Sin datos de telemetry',
    loading: 'Cargando...',
    ms: 'ms',
    seconds: 's',
    lastUpdated: 'Última actualización',
    refresh: 'Actualizar',
  },
  en: {
    title: 'Telemetry Metrics',
    subtitle: 'Bot performance and statistics',
    received: 'Messages Received',
    sent: 'Messages Sent',
    latency: 'Average Latency',
    confidence: 'Average Confidence',
    errorRate: 'Error Rate',
    noData: 'No telemetry data',
    loading: 'Loading...',
    ms: 'ms',
    seconds: 's',
    lastUpdated: 'Last updated',
    refresh: 'Refresh',
  },
};

// Mock telemetry data - in production this would come from OpenTelemetry metrics
function getMockTelemetry(): TelemetryData {
  return {
    messages_received: Math.floor(Math.random() * 1000) + 500,
    messages_sent: Math.floor(Math.random() * 900) + 400,
    avg_latency_ms: Math.random() * 500 + 100,
    avg_confidence: Math.random() * 0.3 + 0.7,
    error_rate: Math.random() * 0.05,
    period: 'last_hour',
  };
}

export default function TelemetryDashboard({ apiUrl, locale = 'es' }: Props) {
  const t = translations[locale];
  const [data, setData] = useState<TelemetryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);

    try {
      // In production, this would fetch from OpenTelemetry/Cloud Monitoring
      // For now, we'll use mock data
      const mockData = getMockTelemetry();
      setData(mockData);
      setLastUpdated(new Date());
    } catch (e) {
      console.error('Failed to fetch telemetry:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
    // Refresh every 60 seconds
    const interval = setInterval(fetchTelemetry, 60000);
    return () => clearInterval(interval);
  }, [apiUrl]);

  if (loading && !data) {
    return (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">{t.title}</h3>
        <p class="text-gray-500">{t.loading}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 class="text-lg font-semibold mb-4">{t.title}</h3>
        <p class="text-gray-500">{t.noData}</p>
      </div>
    );
  }

  const confidencePercent = Math.round(data.avg_confidence * 100);
  const errorPercent = Math.round(data.error_rate * 100);

  return (
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div class="flex justify-between items-start mb-6">
        <div>
          <h3 class="text-lg font-semibold">{t.title}</h3>
          <p class="text-sm text-gray-500">{t.subtitle}</p>
        </div>
        <button
          onClick={fetchTelemetry}
          class="px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
          disabled={loading}
        >
          {loading ? t.loading : t.refresh}
        </button>
      </div>

      {/* Metrics Grid */}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard icon="📥" label={t.received} value={data.messages_received.toLocaleString()} color="blue" />
        <MetricCard icon="📤" label={t.sent} value={data.messages_sent.toLocaleString()} color="green" />
        <MetricCard icon="⚡" label={t.latency} value={`${data.avg_latency_ms.toFixed(0)}${t.ms}`} color="yellow" />
        <MetricCard
          icon="🎯"
          label={t.confidence}
          value={`${confidencePercent}%`}
          color="purple"
          progress={confidencePercent}
        />
      </div>

      {/* Confidence Gauge */}
      <div class="mb-6">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-500">{t.confidence}</span>
          <span class="font-medium">{confidencePercent}%</span>
        </div>
        <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all ${
              confidencePercent >= 80 ? 'bg-green-500' : confidencePercent >= 60 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${confidencePercent}%` }}
          />
        </div>
      </div>

      {/* Error Rate */}
      <div class="mb-6">
        <div class="flex justify-between text-sm mb-1">
          <span class="text-gray-500">{t.errorRate}</span>
          <span
            class={`font-medium ${
              errorPercent <= 2 ? 'text-green-600' : errorPercent <= 5 ? 'text-yellow-600' : 'text-red-600'
            }`}
          >
            {errorPercent}%
          </span>
        </div>
        <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            class={`h-full rounded-full transition-all ${
              errorPercent <= 2 ? 'bg-green-500' : errorPercent <= 5 ? 'bg-yellow-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(errorPercent * 10, 100)}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      {lastUpdated && (
        <div class="text-xs text-gray-400 text-right">
          {t.lastUpdated}: {lastUpdated.toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}

interface MetricCardProps {
  icon: string;
  label: string;
  value: string;
  color: 'blue' | 'green' | 'yellow' | 'purple';
  progress?: number;
}

function MetricCard({ icon, label, value, color, progress }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    yellow: 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
  };

  return (
    <div class={`p-4 rounded-lg ${colorClasses[color]}`}>
      <div class="flex items-center gap-2 mb-2">
        <span class="text-xl">{icon}</span>
        <p class="text-xs font-medium opacity-75">{label}</p>
      </div>
      <p class="text-2xl font-bold">{value}</p>
      {progress !== undefined && (
        <div class="mt-2 h-1 bg-white/30 rounded-full overflow-hidden">
          <div class="h-full bg-white/50 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
