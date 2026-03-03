import { GenericProgramAdapter, getAdapter } from '../src/background/adapters';

describe('adapters', () => {
  it('returns GenericProgramAdapter for known programs', () => {
    const unitedAdapter = getAdapter('united-shopping');
    expect(unitedAdapter).toBeInstanceOf(GenericProgramAdapter);
  });

  it('preserves program metadata', () => {
    const unitedAdapter = new GenericProgramAdapter('united-shopping');
    expect(unitedAdapter.id).toBe('united-shopping');
    expect(unitedAdapter.displayName).toBe('United MileagePlus Shopping');
    expect(unitedAdapter.programType).toBe('airline');
  });

  it('handles partial settings storage in isEnabled without throwing', async () => {
    await chrome.storage.sync.set({
      settings: { enableNotifications: true },
    });

    const unitedAdapter = new GenericProgramAdapter('united-shopping');
    await expect(unitedAdapter.isEnabled()).resolves.toBe(true);
  });

  it('throws when activation base URL is missing for a program', () => {
    const deltaAdapter = new GenericProgramAdapter('delta-skymiles-shopping');
    expect(() => deltaAdapter.buildActivationUrl('nike.com', 'https://www.nike.com/')).toThrow(
      'Missing activation base URL for program'
    );
  });

  it('falls back to static merchant domains when remote refresh fails', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => {
      throw new Error('backend down');
    }) as unknown as typeof fetch;

    const unitedAdapter = new GenericProgramAdapter('united-shopping');
    const domains = await unitedAdapter.refreshMerchantDomains();
    expect(domains).toContain('nike.com');

    global.fetch = originalFetch;
  });
});
