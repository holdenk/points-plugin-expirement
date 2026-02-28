import {
  findProgramForUrl,
  calculateEstimatedPoints,
  findOpportunities,
  getStoredBalances,
  saveBalances,
  upsertBalance,
  getSettings,
  handleMessage,
  handleInstalled,
} from '../src/background/background';
import {
  MessageType,
  StorageKey,
  DEFAULT_SETTINGS,
  KNOWN_PROGRAMS,
} from '../src/types/index';

describe('findProgramForUrl', () => {
  it('finds Amazon program for amazon.com URL', () => {
    const program = findProgramForUrl('https://www.amazon.com/product/123');
    expect(program).toBeDefined();
    expect(program?.id).toBe('amazon-rewards');
  });

  it('finds Target program for target.com URL', () => {
    const program = findProgramForUrl('https://www.target.com/p/item');
    expect(program).toBeDefined();
    expect(program?.id).toBe('target-circle');
  });

  it('returns undefined for unknown domain', () => {
    const program = findProgramForUrl('https://www.example.com/product');
    expect(program).toBeUndefined();
  });

  it('returns undefined for invalid URL', () => {
    const program = findProgramForUrl('not-a-url');
    expect(program).toBeUndefined();
  });

  it('uses provided programs list', () => {
    const customPrograms = [
      {
        id: 'custom-program',
        name: 'Custom Program',
        retailerDomain: 'custom.com',
        pointsPerDollar: 2,
        currency: 'points',
      },
    ];
    const program = findProgramForUrl('https://custom.com/shop', customPrograms);
    expect(program?.id).toBe('custom-program');
  });
});

describe('calculateEstimatedPoints', () => {
  it('calculates points correctly', () => {
    const program = KNOWN_PROGRAMS.find((p) => p.id === 'amazon-rewards')!;
    expect(calculateEstimatedPoints(program, 100)).toBe(300);
  });

  it('floors fractional points', () => {
    const program = { ...KNOWN_PROGRAMS[0], pointsPerDollar: 1.5 };
    expect(calculateEstimatedPoints(program, 3)).toBe(4); // floor(1.5 * 3)
  });

  it('uses default spend of 50 when not provided', () => {
    const program = KNOWN_PROGRAMS.find((p) => p.id === 'amazon-rewards')!;
    expect(calculateEstimatedPoints(program)).toBe(150); // 3 * 50
  });
});

describe('storage operations', () => {
  it('getStoredBalances returns empty array when no balances stored', async () => {
    const balances = await getStoredBalances();
    expect(balances).toEqual([]);
  });

  it('saveBalances persists balances', async () => {
    const testBalances = [{ programId: 'amazon-rewards', balance: 1500, lastUpdated: Date.now() }];
    await saveBalances(testBalances);
    const retrieved = await getStoredBalances();
    expect(retrieved).toEqual(testBalances);
  });

  it('upsertBalance adds new balance', async () => {
    const newBalance = { programId: 'amazon-rewards', balance: 500, lastUpdated: Date.now() };
    await upsertBalance(newBalance);
    const balances = await getStoredBalances();
    expect(balances).toHaveLength(1);
    expect(balances[0]).toEqual(newBalance);
  });

  it('upsertBalance updates existing balance', async () => {
    const initial = { programId: 'amazon-rewards', balance: 500, lastUpdated: Date.now() };
    await upsertBalance(initial);

    const updated = { programId: 'amazon-rewards', balance: 1000, lastUpdated: Date.now() };
    await upsertBalance(updated);

    const balances = await getStoredBalances();
    expect(balances).toHaveLength(1);
    expect(balances[0].balance).toBe(1000);
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
  it('returns empty array for unknown URL', async () => {
    const opps = await findOpportunities('https://unknown.com');
    expect(opps).toEqual([]);
  });

  it('returns opportunity for known retailer', async () => {
    const opps = await findOpportunities('https://www.amazon.com/product/123');
    expect(opps).toHaveLength(1);
    expect(opps[0].retailerName).toBe('Amazon Rewards');
    expect(opps[0].programId).toBe('amazon-rewards');
  });

  it('filters by enabled programs when specified', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        enabledPrograms: ['target-circle'],
      },
    });
    const opps = await findOpportunities('https://www.amazon.com/product/123');
    expect(opps).toEqual([]);
  });

  it('respects minimum points threshold', async () => {
    await chrome.storage.sync.set({
      [StorageKey.SETTINGS]: {
        ...DEFAULT_SETTINGS,
        minimumPointsThreshold: 10000,
      },
    });
    const opps = await findOpportunities('https://www.amazon.com/product/123');
    expect(opps).toEqual([]);
  });
});

describe('handleMessage', () => {
  it('handles GET_OPPORTUNITIES message', (done) => {
    const message = {
      type: MessageType.GET_OPPORTUNITIES,
      url: 'https://www.amazon.com/product/123',
    };
    const sendResponse = jest.fn((response) => {
      expect(response.type).toBe(MessageType.OPPORTUNITIES_RESULT);
      done();
    });
    handleMessage(message as never, {} as chrome.runtime.MessageSender, sendResponse);
  });

  it('handles GET_BALANCES message', (done) => {
    const message = { type: MessageType.GET_BALANCES };
    const sendResponse = jest.fn((response) => {
      expect(response.type).toBe(MessageType.BALANCES_RESULT);
      done();
    });
    handleMessage(message as never, {} as chrome.runtime.MessageSender, sendResponse);
  });

  it('handles UPDATE_BALANCE message', (done) => {
    const message = {
      type: MessageType.UPDATE_BALANCE,
      balance: { programId: 'amazon-rewards', balance: 1000, lastUpdated: Date.now() },
    };
    const sendResponse = jest.fn((_response) => {
      done();
    });
    handleMessage(message as never, {} as chrome.runtime.MessageSender, sendResponse);
  });

  it('handles CONTENT_LOADED message', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const message = {
      type: MessageType.CONTENT_LOADED,
      url: 'https://www.amazon.com',
    };
    const result = handleMessage(
      message as never,
      {} as chrome.runtime.MessageSender,
      jest.fn()
    );
    expect(result).toBe(false);
    consoleSpy.mockRestore();
  });
});

describe('handleInstalled', () => {
  it('sets default settings on fresh install', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    handleInstalled({ reason: 'install' as chrome.runtime.OnInstalledReason, id: '' });
    expect(chrome.storage.sync.set).toHaveBeenCalledWith({
      [StorageKey.SETTINGS]: DEFAULT_SETTINGS,
    });
    consoleSpy.mockRestore();
  });

  it('logs update message on update', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    handleInstalled({ reason: 'update' as chrome.runtime.OnInstalledReason, previousVersion: '0.9.0', id: '' });
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('updated'));
    consoleSpy.mockRestore();
  });
});
