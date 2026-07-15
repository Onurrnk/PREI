// Zaman çizelgesi damgaları ISO string olarak gelir — göreli biçime çevrilir.
export const formatRelativeTime = (iso: string, locale: string): string => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return locale.startsWith('tr') ? 'az önce' : 'just now';
  if (minutes < 60) return locale.startsWith('tr') ? `${minutes}dk` : `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale.startsWith('tr') ? `${hours}sa` : `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 30) return locale.startsWith('tr') ? `${days}g` : `${days}d`;
  return new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: 'short' });
};
