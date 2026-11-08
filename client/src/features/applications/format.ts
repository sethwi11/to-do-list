/** "today", "1 day ago", "16 days ago", "3 weeks ago" */
export function ago(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** "12%" (or an en dash when there's nothing to divide yet). */
export const percent = (rate: number | null) => (rate === null ? '–' : `${Math.round(rate * 100)}%`);

/** "stripe.com" from a link, or the link itself if it can't be read as one (so a bad value never breaks the page). */
export function hostOf(link: string): string {
  try {
    return new URL(link).host;
  } catch {
    return link;
  }
}
