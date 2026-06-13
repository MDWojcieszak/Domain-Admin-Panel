import { BadRequestException } from '@nestjs/common';
import { BlogSectionType } from '@prisma/client';

/**
 * Single-table-inheritance field↔type contract (enforced in the app — the DB
 * does not). Each section type allows only a subset of the language-neutral
 * scalar fields and a subset of child collections.
 */

/** Language-neutral scalar fields that exist on BlogSection. */
const ALL_NEUTRAL_FIELDS = [
  'headingLevel',
  'quoteAuthor',
  'calloutVariant',
  'galleryLayout',
  'embedUrl',
  'embedProvider',
  'columnWidth',
] as const;

type NeutralField = (typeof ALL_NEUTRAL_FIELDS)[number];

const NEUTRAL_FIELDS_BY_TYPE: Record<BlogSectionType, NeutralField[]> = {
  HEADING: ['headingLevel'],
  PARAGRAPH: [],
  QUOTE: ['quoteAuthor'],
  CALLOUT: ['calloutVariant'],
  LIST: [],
  IMAGE: [],
  GALLERY: ['galleryLayout'],
  MAP: [],
  PLACE: [],
  EMBED: ['embedUrl', 'embedProvider'],
  DIVIDER: [],
  COLUMNS: [],
  COLUMN: ['columnWidth'],
};

/** Section types that may carry BlogSectionImage children. */
const IMAGE_TYPES: BlogSectionType[] = [
  BlogSectionType.IMAGE,
  BlogSectionType.GALLERY,
];

/** Section types limited to a single image. */
const SINGLE_IMAGE_TYPES: BlogSectionType[] = [BlogSectionType.IMAGE];

/** Section types that may carry BlogSectionListItem children. */
const LIST_TYPES: BlogSectionType[] = [BlogSectionType.LIST];

/** Section types that may carry SectionPoi children. */
const POI_TYPES: BlogSectionType[] = [
  BlogSectionType.MAP,
  BlogSectionType.PLACE,
];

/** Section types limited to a single POI. */
const SINGLE_POI_TYPES: BlogSectionType[] = [BlogSectionType.PLACE];

/**
 * Rejects any neutral field set on `fields` that is not valid for `type`.
 * Only considers fields that are present and non-null (clearing is harmless).
 */
export function assertNeutralFieldsForType(
  type: BlogSectionType,
  fields: Partial<Record<NeutralField, unknown>>,
): void {
  const allowed = new Set(NEUTRAL_FIELDS_BY_TYPE[type]);

  for (const field of ALL_NEUTRAL_FIELDS) {
    const value = fields[field];
    if (value !== undefined && value !== null && !allowed.has(field)) {
      throw new BadRequestException(
        `Field "${field}" is not valid for section type ${type}`,
      );
    }
  }
}

export function assertImagesAllowed(type: BlogSectionType): void {
  if (!IMAGE_TYPES.includes(type)) {
    throw new BadRequestException(`Section type ${type} cannot have images`);
  }
}

export function isSingleImageType(type: BlogSectionType): boolean {
  return SINGLE_IMAGE_TYPES.includes(type);
}

export function assertItemsAllowed(type: BlogSectionType): void {
  if (!LIST_TYPES.includes(type)) {
    throw new BadRequestException(
      `Section type ${type} cannot have list items`,
    );
  }
}

export function assertPoisAllowed(type: BlogSectionType): void {
  if (!POI_TYPES.includes(type)) {
    throw new BadRequestException(`Section type ${type} cannot have POIs`);
  }
}

export function isSinglePoiType(type: BlogSectionType): boolean {
  return SINGLE_POI_TYPES.includes(type);
}
