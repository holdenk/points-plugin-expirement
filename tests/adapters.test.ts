import { GenericProgramAdapter, getAdapter } from '../src/background/adapters';
import { StorageKey, DEFAULT_SETTINGS } from '../src/types/index';

let originalFetch: typeof global.fetch;

beforeEach(() => {
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('adapters', () => {
  it('returns GenericProgramAdapter for known programs', () => {
    const unitedAdapter = getAdapter('united-shopping');
    expect(unitedAdapter).toBeInstanceOf(GenericProgramAdapter);
  });

  it('caches adapter instances across calls', () => {
    const first = getAdapter('united-shopping');
    const second = getAdapter('united-shopping');
    expect(first).toBe(second);
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

  it('returns false from isEnabled when program is not in enabled list', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['rakuten'],
      },
    });

    const unitedAdapter = new GenericProgramAdapter('united-shopping');
    await expect(unitedAdapter.isEnabled()).resolves.toBe(false);
  });

  it('returns true from isEnabled when program is in enabled list', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['united-shopping'],
      },
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

  it('builds activation URL for programs with loginUrl', async () => {
    const rakutenAdapter = new GenericProgramAdapter('rakuten');
    const url = await rakutenAdapter.buildActivationUrl('nike.com', 'https://www.nike.com/');
    expect(url).toContain('target=');
    expect(url).toContain('rakuten.com');
  });

  it('detects attribution risk from tracking parameters', async () => {
    const adapter = new GenericProgramAdapter('rakuten');
    const risk = await adapter.detectAttributionRisk('https://www.nike.com/?tag=abc');
    expect(risk).toBe('possible_affiliate_tag');
  });

  it('reports no attribution risk for clean URLs', async () => {
    const adapter = new GenericProgramAdapter('rakuten');
    const risk = await adapter.detectAttributionRisk('https://www.nike.com/');
    expect(risk).toBe('none');
  });

  it('falls back to static merchant domains when remote refresh fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('backend down');
    }) as unknown as typeof fetch;

    const unitedAdapter = new GenericProgramAdapter('united-shopping');
    const domains = await unitedAdapter.refreshMerchantDomains();
    expect(domains).toContain('nike.com');
  });

  it('returns null from refreshOffer when program has no API base URL', async () => {
    const deltaAdapter = new GenericProgramAdapter('delta-skymiles-shopping');
    const offer = await deltaAdapter.refreshOffer('nike.com');
    expect(offer).toBeNull();
  });

  it('returns null from refreshOffer when remote API fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('backend down');
    }) as unknown as typeof fetch;

    const adapter = new GenericProgramAdapter('rakuten');
    const offer = await adapter.refreshOffer('nike.com');
    expect(offer).toBeNull();
  });
});
