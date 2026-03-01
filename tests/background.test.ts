import {
  buildActivationUrl,
  calculateEstimatedPoints,
  findOpportunities,
  getSettings,
  handleInstalled,
  handleMessage,
} from '../src/background/background';
import {
  MessageType,
  StorageKey,
  DEFAULT_SETTINGS,
  KNOWN_PROGRAMS,
} from '../src/types/index';

describe('calculateEstimatedPoints', () => {
  it('calculates points correctly', () => {
    const program = KNOWN_PROGRAMS.find((p) => p.id === 'aa-eshopping')!;
    expect(calculateEstimatedPoints(program, 100)).toBe(200);
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

  it('returns no opportunities for non-merchant URL', async () => {
    const opps = await findOpportunities('https://www.wikipedia.org');
    expect(opps).toEqual([]);
  });

  it('returns no opportunities for invalid URL input', async () => {
    const opps = await findOpportunities('not-a-url');
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

  it('returns opportunities for two enabled miles backends on the same merchant page', async () => {
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

  it('returns structured error for invalid merchant URL', async () => {
    const result = await buildActivationUrl('united-shopping', 'not-a-url');
    expect(result.error).toBe('Invalid merchant URL');
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
});

describe('handleInstalled', () => {
  it('opens options on install', () => {
    handleInstalled({ reason: 'install' as chrome.runtime.OnInstalledReason, id: '' });
    expect(chrome.runtime.openOptionsPage).toHaveBeenCalled();
  });
});
