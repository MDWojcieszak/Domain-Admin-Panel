import { CategoryKind } from '@prisma/client';

import { PERMISSIONS } from '../../common/acl/permissions';

/** Default blog locales. Exactly one `isDefault` acts as translation fallback. */
export const SEED_LOCALES: Array<{
  code: string;
  name: string;
  isDefault: boolean;
  order: number;
}> = [
  { code: 'pl', name: 'Polski', isDefault: true, order: 1 },
  { code: 'en', name: 'English', isDefault: false, order: 2 },
];

type SeedCategory = {
  kind: CategoryKind;
  key: string;
  order: number;
  labels: { pl: string; en: string };
};

/**
 * System categories (`isSystem = true`). `key` is the canonical, language-neutral
 * identifier; localized labels live in CategoryTranslation. POST categories are
 * editorial buckets; ATTRACTION categories are POI traits used on the map.
 */
export const SEED_CATEGORIES: SeedCategory[] = [
  // POST
  {
    kind: CategoryKind.POST,
    key: 'travel',
    order: 1,
    labels: { pl: 'Podróże', en: 'Travel' },
  },
  {
    kind: CategoryKind.POST,
    key: 'food',
    order: 2,
    labels: { pl: 'Jedzenie', en: 'Food' },
  },
  {
    kind: CategoryKind.POST,
    key: 'astro',
    order: 3,
    labels: { pl: 'Astro', en: 'Astro' },
  },
  {
    kind: CategoryKind.POST,
    key: 'guide',
    order: 4,
    labels: { pl: 'Przewodnik', en: 'Guide' },
  },
  {
    kind: CategoryKind.POST,
    key: 'nature',
    order: 5,
    labels: { pl: 'Natura', en: 'Nature' },
  },

  // ATTRACTION
  {
    kind: CategoryKind.ATTRACTION,
    key: 'food',
    order: 1,
    labels: { pl: 'Jedzenie', en: 'Food' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'waterfall',
    order: 2,
    labels: { pl: 'Wodospad', en: 'Waterfall' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'viewpoint',
    order: 3,
    labels: { pl: 'Punkt widokowy', en: 'Viewpoint' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'beach',
    order: 4,
    labels: { pl: 'Plaża', en: 'Beach' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'mountain',
    order: 5,
    labels: { pl: 'Góra', en: 'Mountain' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'monument',
    order: 6,
    labels: { pl: 'Zabytek', en: 'Monument' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'museum',
    order: 7,
    labels: { pl: 'Muzeum', en: 'Museum' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'national-park',
    order: 8,
    labels: { pl: 'Park narodowy', en: 'National Park' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'accommodation',
    order: 9,
    labels: { pl: 'Nocleg', en: 'Accommodation' },
  },
  {
    kind: CategoryKind.ATTRACTION,
    key: 'city',
    order: 10,
    labels: { pl: 'Miasto', en: 'City' },
  },
];

/**
 * Seed permission groups. `blog.version.prune` is intentionally NOT bundled into
 * Publisher — it is granted separately to a narrow set of people.
 */
export const SEED_PERMISSION_GROUPS: Array<{
  name: string;
  description: string;
  permissions: string[];
}> = [
  {
    name: 'Content Editor',
    description:
      'Creates and edits content (drafts, sections). Cannot publish.',
    permissions: [
      PERMISSIONS.BLOG_READ,
      PERMISSIONS.BLOG_READ_DRAFT,
      PERMISSIONS.BLOG_WRITE,
    ],
  },
  {
    name: 'Publisher',
    description:
      'Full editorial workflow: edit + publish, categories, places, homepage, analytics.',
    permissions: [
      PERMISSIONS.BLOG_READ,
      PERMISSIONS.BLOG_READ_DRAFT,
      PERMISSIONS.BLOG_WRITE,
      PERMISSIONS.BLOG_PUBLISH,
      PERMISSIONS.BLOG_CATEGORY_MANAGE,
      PERMISSIONS.BLOG_PLACE_MANAGE,
      PERMISSIONS.BLOG_HOME_MANAGE,
      PERMISSIONS.BLOG_ANALYTICS,
    ],
  },
];
