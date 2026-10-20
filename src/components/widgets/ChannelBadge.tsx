interface Props {
  channel: 'whatsapp' | 'instagram' | 'messenger';
}

const labels: Record<string, { text: string; classes: string }> = {
  whatsapp: { text: 'WA', classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  instagram: { text: 'IG', classes: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
  messenger: { text: 'FB', classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
};

export default function ChannelBadge({ channel }: Props) {
  const cfg = labels[channel] || {
    text: (channel || 'CH').slice(0, 2).toUpperCase(),
    classes: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  };
  return <span class={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cfg.classes}`}>{cfg.text}</span>;
}
