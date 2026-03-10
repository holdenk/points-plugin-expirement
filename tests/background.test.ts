import {
  buildActivationUrl,
  calculateEstimatedPoints,
  findOpportunities,
  getSettings,
  handleInstalled,
  handleMessage,
  __resetOpportunityCacheForTests,
} from '../src/background/background';
import {
  MessageType,
  StorageKey,
  DEFAULT_SETTINGS,
  KNOWN_PROGRAMS,
} from '../src/types/index';

let originalFetch: typeof global.fetch;

beforeEach(() => {
  __resetOpportunityCacheForTests();
  originalFetch = global.fetch;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('calculateEstimatedPoints', () => {
  it('calculates points correctly', () => {
    const program = KNOWN_PROGRAMS.find((p) => p.id === 'aa-eshopping')!;
    expect(calculateEstimatedPoints(program, 100)).toBe(200);
  });

  it('supports rate overrides from refreshed offers', () => {
    const program = KNOWN_PROGRAMS.find((p) => p.id === 'aa-eshopping')!;
    expect(calculateEstimatedPoints(program, 100, 3.5)).toBe(350);
  });

  it('returns zero for zero spend', () => {
    const program = KNOWN_PROGRAMS.find((p) => p.id === 'aa-eshopping')!;
    expect(calculateEstimatedPoints(program, 0)).toBe(0);
  });
});

describe('getSettings', () => {
  it('returns default settings when none stored', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('merges stored settings with defaults', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: { enableNotifications: false },
    });
    const settings = await getSettings();
    expect(settings.enableNotifications).toBe(false);
    expect(settings.minimumPointsThreshold).toBe(DEFAULT_SETTINGS.minimumPointsThreshold);
  });
});

describe('findOpportunities', () => {
  it('returns sorted opportunities for known merchant URL', async () => {
    const opps = await findOpportunities('https://www.nike.com');
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0].estimatedValueCents).toBeGreaterThanOrEqual(opps[1]?.estimatedValueCents ?? 0);
  });

  it('returns no opportunities for invalid URL input', async () => {
    const opps = await findOpportunities('not-a-url');
    expect(opps).toEqual([]);
  });

  it('does not show opportunities when tracking is already active on URL', async () => {
    const opps = await findOpportunities('https://www.nike.com/?tag=already-active');
    expect(opps).toEqual([]);
  });

  it('filters by enabled programs', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['rakuten'],
        minimumPointsThreshold: 0,
      },
    });

    const opps = await findOpportunities('https://www.nike.com');
    expect(opps).toHaveLength(1);
    expect(opps[0].programId).toBe('rakuten');
  });

  it('returns opportunities for two enabled miles backends on same merchant page', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['aa-eshopping', 'united-shopping'],
        minimumPointsThreshold: 0,
      },
    });

    const opps = await findOpportunities('https://www.nike.com');
    expect(opps).toHaveLength(2);
    expect(opps.map((opp) => opp.programId).sort()).toEqual(['aa-eshopping', 'united-shopping']);
  });

  it('uses programName instead of retailerName in opportunities', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['rakuten'],
        minimumPointsThreshold: 0,
      },
    });

    const opps = await findOpportunities('https://www.nike.com');
    expect(opps[0].programName).toBe('Rakuten');
  });

  it('uses page price when provided', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['rakuten'],
        minimumPointsThreshold: 0,
      },
    });

    const oppsDefault = await findOpportunities('https://www.nike.com');
    __resetOpportunityCacheForTests();
    const oppsWithPrice = await findOpportunities('https://www.nike.com', 200);
    expect(oppsWithPrice[0].estimatedPoints).toBeGreaterThan(oppsDefault[0].estimatedPoints);
  });

  it('uses cached domains/offers on subsequent requests within TTL', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/extension/merchant-domains')) {
        return {
          ok: true,
          json: async () => ({ domains: ['nike.com'] }),
        } as Response;
      }

      if (url.includes('/api/extension/offers')) {
        return {
          ok: true,
          json: async () => ({ pointsPerDollar: 4 }),
        } as Response;
      }

      return { ok: false, json: async () => ({}) } as Response;
    }) as unknown as typeof fetch;

    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['united-shopping'],
        minimumPointsThreshold: 0,
      },
    });

    await findOpportunities('https://www.nike.com');
    await new Promise((resolve) => setTimeout(resolve, 0));
    await findOpportunities('https://www.nike.com');

    expect((global.fetch as jest.Mock).mock.calls.length).toBe(2);
  });

  it('refreshes stale cache entries opportunistically', async () => {
    const old = Date.now() - (2 * 24 * 60 * 60 * 1000);
    await chrome.storage.local.set({
      [StorageKey.OPPORTUNITY_CACHE]: {
        merchantDomainsByProgram: {
          'united-shopping': { domains: ['nike.com'], fetchedAt: old },
        },
        offersByProgramAndStore: {
          'united-shopping': {
            'nike.com': { pointsPerDollar: 2, fetchedAt: old },
          },
        },
      },
    });

    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ domains: ['nike.com'], pointsPerDollar: 3 }),
    }) as Response) as unknown as typeof fetch;

    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['united-shopping'],
        minimumPointsThreshold: 0,
      },
    });

    const opps = await findOpportunities('https://www.nike.com');
    expect(opps).toHaveLength(1);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('continues when one backend refresh fails (non-blocking)', async () => {
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('aadvantageeshopping.com')) {
        throw new Error('aa backend down');
      }
      return {
        ok: false,
        json: async () => ({}),
      } as Response;
    }) as unknown as typeof fetch;

    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['aa-eshopping', 'united-shopping'],
        minimumPointsThreshold: 0,
      },
    });

    const opps = await findOpportunities('https://www.nike.com');
    expect(opps.length).toBeGreaterThan(0);
    expect(opps.some((opp) => opp.programId === 'united-shopping')).toBe(true);
  });
});

describe('buildActivationUrl', () => {
  it('builds activation URL and returns risk metadata', async () => {
    const result = await buildActivationUrl('rakuten', 'https://www.nike.com?tag=abc');
    expect(result.type).toBe(MessageType.ACTIVATION_URL_RESULT);
    expect(result.activationUrl).toContain('target=');
    expect(result.attributionRisk).toBe('possible_affiliate_tag');
  });

  it('builds United activation URL with encoded target tracking payload', async () => {
    const result = await buildActivationUrl('united-shopping', 'https://www.nike.com/');
    const activationUrl = new URL(result.activationUrl);

    expect(activationUrl.hostname).toBe('shopping.mileageplus.com');
    expect(activationUrl.searchParams.get('target')).toBe('https://www.nike.com/');
  });

  it('returns structured error when activation base URL is missing', async () => {
    const result = await buildActivationUrl('delta-skymiles-shopping', 'https://www.nike.com/');
    expect(result.error).toContain('Missing activation base URL');
    expect(result.activationUrl).toBe('');
  });
});

describe('handleMessage', () => {
  it('handles BUILD_ACTIVATION_URL message', (done) => {
    const message = {
      type: MessageType.BUILD_ACTIVATION_URL,
      programId: 'rakuten',
      merchantUrl: 'https://www.nike.com',
    };

    const sendResponse = jest.fn((response) => {
      expect(response.type).toBe(MessageType.ACTIVATION_URL_RESULT);
      done();
    });

    handleMessage(message as never, {} as chrome.runtime.MessageSender, sendResponse);
  });

  it('handles UPDATE_BALANCE message', (done) => {
    const message = {
      type: MessageType.UPDATE_BALANCE,
      balance: { programId: 'rakuten', balance: 1000, lastUpdated: Date.now() },
    };

    const sendResponse = jest.fn((response) => {
      expect(response.type).toBe(MessageType.BALANCES_RESULT);
      done();
    });

    handleMessage(message as never, {} as chrome.runtime.MessageSender, sendResponse);
  });

  it('handles CONTENT_LOADED message synchronously', () => {
    const message = {
      type: MessageType.CONTENT_LOADED,
      url: 'https://www.nike.com',
    };

    const sendResponse = jest.fn();
    const result = handleMessage(message as never, {} as chrome.runtime.MessageSender, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });

  it('returns false for unknown message types', () => {
    const message = { type: 'UNKNOWN_TYPE' };
    const sendResponse = jest.fn();
    const result = handleMessage(message as never, {} as chrome.runtime.MessageSender, sendResponse);

    expect(result).toBe(false);
    expect(sendResponse).not.toHaveBeenCalled();
  });
});

describe('handleInstalled', () => {
  it('opens options on install', () => {
    handleInstalled({ reason: 'install' as chrome.runtime.OnInstalledReason, id: '' });
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});
