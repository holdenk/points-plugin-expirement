// Mock chrome APIs for testing
const mockStorage: Record<string, unknown> = {};

const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    openOptionsPage: jest.fn(),
  },
  storage: {
    local: {
      get: jest.fn(async (key: string) => ({
        [key]: mockStorage[key],
      })),
      set: jest.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
    },
    sync: {
      get: jest.fn(async (key: string) => ({
        [key]: mockStorage[key],
      })),
      set: jest.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
    },
  },
  tabs: {
    query: jest.fn(),
  },
};

// Reset storage before each test
beforeEach(() => {
  Object.keys(mockStorage).forEach((key) => {
    delete mockStorage[key];
  });
  jest.clearAllMocks();
  // Re-apply mock defaults after clearAllMocks
  mockChrome.storage.local.get.mockImplementation(async (key: string) => ({
    [key]: mockStorage[key],
  }));
  mockChrome.storage.local.set.mockImplementation(async (items: Record<string, unknown>) => {
    Object.assign(mockStorage, items);
  });
  mockChrome.storage.sync.get.mockImplementation(async (key: string) => ({
    [key]: mockStorage[key],
  }));
  mockChrome.storage.sync.set.mockImplementation(async (items: Record<string, unknown>) => {
    Object.assign(mockStorage, items);
  });
});

Object.defineProperty(global, 'chrome', {
  value: mockChrome,
  writable: true,
});
