import { ProjectType, StatusCategory } from '@prisma/client';

/**
 * The workflow a new project starts with (D13). Names are the owner's to
 * change; only the category carries meaning.
 */
export const DEFAULT_STATUSES: Record<
  ProjectType,
  { name: string; category: StatusCategory; color: string }[]
> = {
  GENERAL: [
    { name: 'To do', category: StatusCategory.TODO, color: '#94A3B8' },
    {
      name: 'In progress',
      category: StatusCategory.IN_PROGRESS,
      color: '#3B82F6',
    },
    {
      name: 'In review',
      category: StatusCategory.IN_PROGRESS,
      color: '#A855F7',
    },
    { name: 'Done', category: StatusCategory.DONE, color: '#22C55E' },
    { name: 'Dropped', category: StatusCategory.DONE, color: '#64748B' },
  ],
  DIY: [
    { name: 'To do', category: StatusCategory.TODO, color: '#94A3B8' },
    {
      name: 'In progress',
      category: StatusCategory.IN_PROGRESS,
      color: '#3B82F6',
    },
    { name: 'Testing', category: StatusCategory.IN_PROGRESS, color: '#F59E0B' },
    { name: 'Done', category: StatusCategory.DONE, color: '#22C55E' },
    { name: 'Dropped', category: StatusCategory.DONE, color: '#64748B' },
  ],
  TRIP: [
    { name: 'To arrange', category: StatusCategory.TODO, color: '#94A3B8' },
    {
      name: 'In progress',
      category: StatusCategory.IN_PROGRESS,
      color: '#3B82F6',
    },
    { name: 'Arranged', category: StatusCategory.DONE, color: '#22C55E' },
  ],
  LIST: [
    { name: 'To buy', category: StatusCategory.TODO, color: '#94A3B8' },
    { name: 'Bought', category: StatusCategory.DONE, color: '#22C55E' },
  ],
};

/** 2–6 characters, a letter first: ASTRO, HOME2, DIY. */
export const PROJECT_KEY = /^[A-Z][A-Z0-9]{1,5}$/;

/** The personal inbox's key; never derived for another project. */
export const INBOX_KEY = 'INBOX';

const ASCII: Record<string, string> = {
  Ą: 'A',
  Ć: 'C',
  Ę: 'E',
  Ł: 'L',
  Ń: 'N',
  Ó: 'O',
  Ś: 'S',
  Ź: 'Z',
  Ż: 'Z',
};

/**
 * A key from the title, unique among the owner's: initials of several words
 * ("Astro mount build" → AMB), or the start of a single one ("Astro" →
 * ASTRO). A digit is appended when it is taken.
 */
export const deriveProjectKey = (title: string, taken: Set<string>): string => {
  const words = title
    .toUpperCase()
    .replace(/[ĄĆĘŁŃÓŚŹŻ]/g, (c) => ASCII[c])
    .normalize('NFD')
    .replace(/[^A-Z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  let base =
    words.length >= 2
      ? words.map((w) => w[0]).join('')
      : (words[0] ?? '').slice(0, 5);
  if (!/^[A-Z]/.test(base)) base = `P${base}`;
  base = base.slice(0, 6);
  if (base.length < 2) base = `${base}PR`.slice(0, 2);

  const free = (key: string) => !taken.has(key) && key !== INBOX_KEY;
  if (free(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base.slice(0, 6 - String(n).length)}${n}`;
    if (free(candidate)) return candidate;
  }
  return `P${Date.now().toString(36).toUpperCase().slice(-5)}`;
};

export const taskKey = (projectKey: string, number: number) =>
  `${projectKey}-${number}`;
