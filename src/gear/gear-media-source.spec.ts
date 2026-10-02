import { GearCategory } from '@prisma/client';

import {
  CATEGORY_MEDIA_SOURCE,
  GearMediaSource,
  SECURE_ACTION,
  mediaSourceOf,
  producesMedia,
  reminderDaysFor,
} from './gear-media-source';

describe('gear media source', () => {
  // The exhaustive Record is the whole safety property: a new category cannot
  // ship without deciding whether material has to be brought in from it.
  it('covers every GearCategory', () => {
    const categories = Object.values(GearCategory);
    const mapped = Object.keys(CATEGORY_MEDIA_SOURCE);

    expect(mapped.sort()).toEqual([...categories].sort());
  });

  describe('cards', () => {
    it.each([
      GearCategory.CAMERA,
      GearCategory.SMART_TELESCOPE,
      GearCategory.DRONE,
      GearCategory.ACTION_CAM,
    ])('%s records onto a card', (category) => {
      expect(mediaSourceOf(category)).toBe(GearMediaSource.CARD);
      expect(reminderDaysFor(category)).toBe(7);
    });
  });

  describe('film', () => {
    // An analogue body still has material to bring in — via develop and scan.
    it('treats a film body as a media source', () => {
      expect(mediaSourceOf(GearCategory.FILM_CAMERA)).toBe(
        GearMediaSource.FILM,
      );
      expect(producesMedia(GearCategory.FILM_CAMERA)).toBe(true);
    });

    // A shared 7-day threshold would fire after every trip and train the user to
    // ignore the warnings that actually matter.
    it('gives film a far longer threshold than a card', () => {
      expect(reminderDaysFor(GearCategory.FILM_CAMERA)).toBe(90);
      expect(reminderDaysFor(GearCategory.CAMERA)).toBe(7);
    });
  });

  describe('telescopes', () => {
    // The split exists precisely so the mapping is unambiguous.
    it('separates a classic tube from a smart telescope', () => {
      expect(producesMedia(GearCategory.TELESCOPE)).toBe(false);
      expect(producesMedia(GearCategory.SMART_TELESCOPE)).toBe(true);
    });
  });

  describe('memory cards', () => {
    // Counter-intuitive and deliberate: material is secured from the body, so
    // cards as a source would duplicate every checklist row.
    it('does not treat a card as a media source', () => {
      expect(mediaSourceOf(GearCategory.MEMORY_CARD)).toBe(
        GearMediaSource.NONE,
      );
      expect(producesMedia(GearCategory.MEMORY_CARD)).toBe(false);
      expect(reminderDaysFor(GearCategory.MEMORY_CARD)).toBeNull();
    });
  });

  describe('gear that produces nothing', () => {
    it.each([
      GearCategory.LENS,
      GearCategory.FILTER,
      GearCategory.TRIPOD,
      GearCategory.HEAD,
      GearCategory.FLASH,
      GearCategory.BATTERY,
      GearCategory.BAG,
      GearCategory.STRAP,
      GearCategory.CABLE,
      GearCategory.ACCESSORY,
      GearCategory.OTHER,
    ])('%s never appears on a securing list', (category) => {
      expect(producesMedia(category)).toBe(false);
      expect(reminderDaysFor(category)).toBeNull();
    });
  });

  describe('tethered capture', () => {
    // A dedicated astro camera has no card; frames land on the laptop. The
    // obligation is real — one copy on one machine — only the action differs.
    it('treats an astro camera as tethered, not carded', () => {
      expect(mediaSourceOf(GearCategory.ASTRO_CAMERA)).toBe(
        GearMediaSource.TETHERED,
      );
      expect(producesMedia(GearCategory.ASTRO_CAMERA)).toBe(true);
      expect(reminderDaysFor(GearCategory.ASTRO_CAMERA)).toBe(7);
    });

    // The rule: the source is the device that took the photos, never the medium
    // holding them. Counting the laptop would duplicate every checklist row.
    it('does not treat the capture computer as a source', () => {
      expect(producesMedia(GearCategory.COMPUTER)).toBe(false);
      expect(producesMedia(GearCategory.STORAGE)).toBe(false);
    });

    it('spells out what to do for every source', () => {
      expect(SECURE_ACTION[GearMediaSource.CARD]).toMatch(/offload/);
      expect(SECURE_ACTION[GearMediaSource.TETHERED]).toMatch(/copy/);
      expect(SECURE_ACTION[GearMediaSource.FILM]).toMatch(/scan/);
      expect(SECURE_ACTION[GearMediaSource.NONE]).toBeNull();
    });
  });

  describe('visual astro gear', () => {
    it.each([
      GearCategory.EYEPIECE,
      GearCategory.BINOCULARS,
      GearCategory.DIAGONAL,
      GearCategory.DEW_HEATER,
      GearCategory.GUIDE_SCOPE,
    ])('%s records nothing', (category) => {
      expect(producesMedia(category)).toBe(false);
    });
  });

  it('flags exactly six categories as producing media', () => {
    const producing = Object.values(GearCategory).filter(producesMedia);

    expect(producing.sort()).toEqual(
      [
        GearCategory.ACTION_CAM,
        GearCategory.ASTRO_CAMERA,
        GearCategory.CAMERA,
        GearCategory.DRONE,
        GearCategory.FILM_CAMERA,
        GearCategory.SMART_TELESCOPE,
      ].sort(),
    );
  });
});
