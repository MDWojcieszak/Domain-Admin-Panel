/** A morning digest from what is due, late and left to buy. Pure, so its copy is tested alone. */

export interface DigestTask {
  key: string;
  title: string;
  /** Project title, or "Inbox". */
  where: string;
}

export interface DigestLateTask extends DigestTask {
  daysLate: number;
}

export interface DigestBuild {
  project: string;
  parts: number;
  costs: { currency: string | null; total: number }[];
}

export interface DigestList {
  project: string;
  open: number;
}

export interface DigestInput {
  today: DigestTask[];
  late: DigestLateTask[];
  builds: DigestBuild[];
  lists: DigestList[];
}

export interface DigestCopy {
  subject: string;
  subjectName: string;
  headline: string;
  detail: string;
  items: string[];
}

/** Long digests stop here; the rest is a click away. */
export const DIGEST_MAX_LINES = 15;

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const money = (total: number, currency: string | null) =>
  `${total.toFixed(2)}${currency ? ` ${currency}` : ''}`;

const task = (t: DigestTask) =>
  `${t.key} ${t.title}${t.where ? ` (${t.where})` : ''}`;

/**
 * Null when there is nothing to say: no mail beats an empty one. Late work
 * first, oldest first; then today; then what is left to buy.
 */
export const buildDigest = (input: DigestInput): DigestCopy | null => {
  const late = [...input.late].sort((a, b) => b.daysLate - a.daysLate);
  const builds = input.builds.filter((b) => b.parts > 0);
  const lists = input.lists.filter((l) => l.open > 0);
  if (!late.length && !input.today.length && !builds.length && !lists.length)
    return null;

  const lines = [
    ...late.map((t) => `Late ${plural(t.daysLate, 'day')} · ${task(t)}`),
    ...input.today.map((t) => `Today · ${task(t)}`),
    ...builds.map((b) => {
      const cost = b.costs
        .filter((c) => c.total > 0)
        .map((c) => money(c.total, c.currency));
      return `To buy · ${b.project}: ${plural(b.parts, 'part')}${cost.length ? `, ${cost.join(' + ')}` : ''}`;
    }),
    ...lists.map(
      (l) => `Shopping list · ${l.project}: ${plural(l.open, 'item')} left`,
    ),
  ];
  const items =
    lines.length > DIGEST_MAX_LINES
      ? [
          ...lines.slice(0, DIGEST_MAX_LINES - 1),
          `…and ${lines.length - DIGEST_MAX_LINES + 1} more in the panel`,
        ]
      : lines;

  const parts = [
    input.today.length ? `${input.today.length} due` : '',
    late.length ? `${late.length} late` : '',
    builds.length
      ? `${plural(
          builds.reduce((n, b) => n + b.parts, 0),
          'part',
        )} to buy`
      : '',
  ].filter(Boolean);
  const headline = parts.length
    ? parts.join(', ')
    : plural(
        lists.reduce((n, l) => n + l.open, 0),
        'item',
      ) + ' on your lists';

  return {
    subject: `Today: ${headline}`,
    subjectName: 'Today',
    headline,
    detail: late.length
      ? 'The late ones first — tick off what is done, move what can wait.'
      : 'Your day at a glance.',
    items,
  };
};
