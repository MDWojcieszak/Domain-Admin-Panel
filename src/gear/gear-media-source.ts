import { GearCategory } from '@prisma/client';

/**
 * What a piece of gear produces that has to be brought into the system
 * (docs/photo-entry-redesign.md D5).
 *
 * Not "does it have storage": film has to be brought in too, just via
 * develop → scan → import. The obligation is the same, only the mechanism
 * differs — so this is an enum, not a boolean.
 */
export enum GearMediaSource {
  /** Produces nothing — tripod, filter, bag, cable. */
  NONE = 'NONE',
  /** Memory card — offload it. */
  CARD = 'CARD',
  /** Film — develop and scan it. */
  FILM = 'FILM',
  /** Captured straight onto a tethered computer — copy it into the entry. */
  TETHERED = 'TETHERED',
}

/**
 * The rule that settles every entry below:
 *
 * **The source is the device that TOOK the photos, never the medium they happen
 * to be sitting on.** That is why a memory card and a laptop are both NONE —
 * counting them would duplicate every checklist row, once for the body and once
 * for whatever is holding its bytes right now.
 */

/**
 * Category → media source. **Exhaustive on purpose**: adding a value to
 * `GearCategory` will not compile until its source is decided here.
 *
 * That is why this lives in code rather than as a column. A column would have
 * let a new category default to "nothing to secure" silently, and the cost of
 * that mistake is a formatted card — photos lost for good.
 */
export const CATEGORY_MEDIA_SOURCE: Record<GearCategory, GearMediaSource> = {
  // bodies that record onto a card
  CAMERA: GearMediaSource.CARD,
  SMART_TELESCOPE: GearMediaSource.CARD,
  DRONE: GearMediaSource.CARD,
  ACTION_CAM: GearMediaSource.CARD,

  // records onto film
  FILM_CAMERA: GearMediaSource.FILM,

  /**
   * A dedicated astro camera has no card of its own — frames land on the laptop
   * running the capture software. The obligation is still real (a single copy on
   * one machine), only the action differs: copy, not offload.
   */
  ASTRO_CAMERA: GearMediaSource.TETHERED,

  // optics and support — nothing to bring in
  LENS: GearMediaSource.NONE,
  TELECONVERTER: GearMediaSource.NONE, // a Barlow is this, optically
  ADAPTER: GearMediaSource.NONE,
  FILTER: GearMediaSource.NONE,
  TELESCOPE: GearMediaSource.NONE,
  GUIDE_SCOPE: GearMediaSource.NONE, // feeds the guider, records nothing
  MOUNT: GearMediaSource.NONE,
  EYEPIECE: GearMediaSource.NONE,
  BINOCULARS: GearMediaSource.NONE,
  DIAGONAL: GearMediaSource.NONE,
  DEW_HEATER: GearMediaSource.NONE,
  TRIPOD: GearMediaSource.NONE,
  HEAD: GearMediaSource.NONE,
  GIMBAL: GearMediaSource.NONE,

  // light
  FLASH: GearMediaSource.NONE,
  LIGHTING: GearMediaSource.NONE,
  LIGHT_MODIFIER: GearMediaSource.NONE,

  // power
  BATTERY: GearMediaSource.NONE,
  CHARGER: GearMediaSource.NONE,
  POWER_BANK: GearMediaSource.NONE,
  POWER_STATION: GearMediaSource.NONE,

  REMOTE: GearMediaSource.NONE,

  // Media that only HOLDS bytes is never a source — see the rule above. Both of
  // these are packing-list items; the capture device owns the obligation.
  MEMORY_CARD: GearMediaSource.NONE,
  COMPUTER: GearMediaSource.NONE,
  CARD_READER: GearMediaSource.NONE,
  STORAGE: GearMediaSource.NONE,

  // carrying and protection
  BAG: GearMediaSource.NONE,
  STRAP: GearMediaSource.NONE,
  RAIN_COVER: GearMediaSource.NONE,
  CLEANING: GearMediaSource.NONE,
  CABLE: GearMediaSource.NONE,

  ACCESSORY: GearMediaSource.NONE,
  OTHER: GearMediaSource.NONE,
};

/**
 * How long material may sit unsecured before the entry is flagged (§6).
 *
 * The thresholds differ because the risk differs in kind: a card goes back into
 * the camera and gets formatted, which is irreversible. Film does not overwrite
 * itself — the risk is a roll forgotten in a drawer. One shared 7-day threshold
 * would fire after every trip with film and teach the user to ignore these
 * warnings, which would also wreck the card warnings that do matter.
 */
export const SECURE_REMINDER_DAYS: Record<GearMediaSource, number | null> = {
  [GearMediaSource.NONE]: null,
  [GearMediaSource.CARD]: 7,
  /** One copy on a working machine, which gets reinstalled and wiped. */
  [GearMediaSource.TETHERED]: 7,
  [GearMediaSource.FILM]: 90,
};

/** What the checklist should actually tell you to do. */
export const SECURE_ACTION: Record<GearMediaSource, string | null> = {
  [GearMediaSource.NONE]: null,
  [GearMediaSource.CARD]: 'offload the card',
  [GearMediaSource.TETHERED]: 'copy the frames off the capture computer',
  [GearMediaSource.FILM]: 'develop and scan',
};

export const mediaSourceOf = (category: GearCategory): GearMediaSource =>
  CATEGORY_MEDIA_SOURCE[category];

/** True when this gear holds material that has to be brought in. */
export const producesMedia = (category: GearCategory): boolean =>
  CATEGORY_MEDIA_SOURCE[category] !== GearMediaSource.NONE;

/** Null for gear that produces nothing. */
export const reminderDaysFor = (category: GearCategory): number | null =>
  SECURE_REMINDER_DAYS[CATEGORY_MEDIA_SOURCE[category]];
