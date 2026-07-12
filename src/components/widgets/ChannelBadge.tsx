interface Props { channel: 'whatsapp' | 'instagram'; }

const labels = {
  whatsapp: { text: 'WA', classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
  instagram: { text: 'IG', classes: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200' },
};

export default function ChannelBadge({ channel }: Props) {
  const cfg = labels[channel];
  return (
    <span class={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${cfg.classes}`}>
      {cfg.text}
    </span>
  );
}