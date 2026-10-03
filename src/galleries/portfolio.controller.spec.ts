import { PortfolioController } from './portfolio.controller';

/* eslint-disable @typescript-eslint/no-explicit-any */

describe('PortfolioController.bySlug', () => {
  it('returns the gallery with the contact form in the requested language', async () => {
    const galleries: any = {
      getPublishedBySlug: jest
        .fn()
        .mockResolvedValue({ id: 'g1', slug: 'iceland', items: [] }),
    };
    const contact: any = {
      getPublic: jest.fn().mockResolvedValue({
        enabled: true,
        locale: 'en',
        privacyNotice: 'Notice',
        privacyNoticeLocale: 'en',
      }),
    };
    const controller = new PortfolioController(galleries, {} as any, contact);

    const page = await controller.bySlug('iceland', { locale: 'en' });

    expect(contact.getPublic).toHaveBeenCalledWith('en');
    expect(page).toMatchObject({
      slug: 'iceland',
      contact: { locale: 'en', privacyNoticeLocale: 'en' },
    });
  });
});
