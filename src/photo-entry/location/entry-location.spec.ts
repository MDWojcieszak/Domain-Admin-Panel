import { applyLocation, assertTimezone, timezoneAt } from './entry-location';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('timezoneAt', () => {
  it('is exact at borders, where golden hour depends on it', () => {
    expect(timezoneAt(49.1, 22.6)).toBe('Europe/Warsaw'); // Bieszczady
    expect(timezoneAt(49.84, 24.03)).toBe('Europe/Kyiv'); // Lviv
    expect(timezoneAt(52.34, 14.55)).toBe('Europe/Berlin'); // Frankfurt (Oder)
  });

  it('uses real zone names, not merged equivalents', () => {
    expect(timezoneAt(64.0, -19.0)).toBe('Atlantic/Reykjavik');
  });
});

describe('assertTimezone', () => {
  it('rejects unknown zones', () => {
    expect(assertTimezone('Europe/Madrid')).toBe('Europe/Madrid');
    expect(() => assertTimezone('Mars/Olympus')).toThrow(/Unknown time zone/);
  });
});

describe('applyLocation', () => {
  const tx = () => ({
    location: {
      create: jest.fn().mockResolvedValue({ id: 'loc1' }),
      update: jest.fn(),
      delete: jest.fn(),
    },
    photoEntry: { update: jest.fn() },
  });
  const entry = (locationId: string | null = null) => ({
    id: 'pe1',
    userId: 'u1',
    locationId,
  });

  it('creates and links a location, resolving its time zone', async () => {
    const t = tx();
    await applyLocation(t as any, entry(), { latitude: 49.1, longitude: 22.6 });
    expect(t.location.create.mock.calls[0][0].data).toMatchObject({
      latitude: 49.1,
      timezone: 'Europe/Warsaw',
      createdById: 'u1',
    });
    expect(t.photoEntry.update).toHaveBeenCalledWith({
      where: { id: 'pe1' },
      data: { locationId: 'loc1' },
    });
  });

  it('updates the existing row instead of creating another', async () => {
    const t = tx();
    await applyLocation(t as any, entry('loc1'), {
      latitude: 36.53,
      longitude: -6.29,
      timezone: 'Europe/Madrid',
    });
    expect(t.location.create).not.toHaveBeenCalled();
    expect(t.location.update.mock.calls[0][0].where).toEqual({ id: 'loc1' });
  });

  it('deletes the entry’s own row when cleared, ignores undefined', async () => {
    const t = tx();
    await applyLocation(t as any, entry('loc1'), undefined);
    expect(t.location.delete).not.toHaveBeenCalled();

    await applyLocation(t as any, entry('loc1'), null);
    expect(t.location.delete).toHaveBeenCalledWith({ where: { id: 'loc1' } });
  });
});
