import { buildDigest, DIGEST_MAX_LINES } from './digest-rules';

const empty = { today: [], late: [], builds: [], lists: [] };

describe('buildDigest', () => {
  it('sends nothing when there is nothing to say', () => {
    expect(buildDigest(empty)).toBeNull();
    expect(
      buildDigest({
        ...empty,
        builds: [{ project: 'X', parts: 0, costs: [] }],
        lists: [{ project: 'L', open: 0 }],
      }),
    ).toBeNull();
  });

  it('lists late work first, oldest first, then today, then what to buy', () => {
    const copy = buildDigest({
      today: [{ key: 'INBOX-3', title: 'Call the shop', where: 'Inbox' }],
      late: [
        {
          key: 'ASTRO-4',
          title: 'Cut plate',
          where: 'Astro mount',
          daysLate: 1,
        },
        {
          key: 'ASTRO-2',
          title: 'Order bearings',
          where: 'Astro mount',
          daysLate: 5,
        },
      ],
      builds: [
        {
          project: 'Astro mount',
          parts: 5,
          costs: [{ currency: 'PLN', total: 312.4 }],
        },
      ],
      lists: [{ project: 'Groceries', open: 7 }],
    })!;
    expect(copy.items).toEqual([
      'Late 5 days · ASTRO-2 Order bearings (Astro mount)',
      'Late 1 day · ASTRO-4 Cut plate (Astro mount)',
      'Today · INBOX-3 Call the shop (Inbox)',
      'To buy · Astro mount: 5 parts, 312.40 PLN',
      'Shopping list · Groceries: 7 items left',
    ]);
    expect(copy.headline).toBe('1 due, 2 late, 5 parts to buy');
    expect(copy.subject).toBe('Today: 1 due, 2 late, 5 parts to buy');
  });

  it('speaks of lists alone when they are all there is', () => {
    const copy = buildDigest({
      ...empty,
      lists: [{ project: 'Groceries', open: 1 }],
    })!;
    expect(copy.headline).toBe('1 item on your lists');
  });

  it('caps a long digest and says how many more', () => {
    const today = Array.from({ length: 30 }, (_, i) => ({
      key: `T-${i}`,
      title: 'x',
      where: '',
    }));
    const copy = buildDigest({ ...empty, today })!;
    expect(copy.items).toHaveLength(DIGEST_MAX_LINES);
    expect(copy.items[DIGEST_MAX_LINES - 1]).toBe(
      `…and ${30 - DIGEST_MAX_LINES + 1} more in the panel`,
    );
  });
});
