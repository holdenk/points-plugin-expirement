import {
  DEFAULT_SETTINGS,
  OfferSnapshot,
  ProgramAdapter,
  StorageKey,
  getProgramById,
  mergeSettings,
  normalizeHostname,
} from '../types/index';

const OFFER_REFRESH_TIMEOUT_MS = 1500;

export const DEFAULT_PROGRAM_MERCHANT_DOMAINS: Record<string, string[]> = {
  'aa-eshopping': ['nike.com', 'macys.com', 'bestbuy.com'],
  'united-shopping': ['nike.com', 'macys.com', 'bestbuy.com'],
  'alaska-atmos': ['nike.com', 'target.com'],
  'delta-skymiles-shopping': ['nike.com', 'walmart.com'],
  'jetblue-trueblue-shopping': ['nike.com', 'etsy.com'],
  'southwest-shopping': ['nike.com', 'ebay.com'],
  rakuten: ['nike.com', 'target.com', 'walmart.com'],
  'capital-one-shopping': ['nike.com', 'bestbuy.com'],
  'mr-rebates': ['nike.com', 'homedepot.com'],
};

function buildGenericActivationUrl(baseUrl: string | undefined, merchantUrl: string): string {
  if (!baseUrl) {
    throw new Error('Missing activation base URL for program');
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}target=${encodeURIComponent(merchantUrl)}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

export class GenericProgramAdapter implements ProgramAdapter {
  id: string;
  displayName: string;
  programType: ProgramAdapter['programType'];

  constructor(programId: string) {
    const program = getProgramById(programId);
    if (!program) {
      throw new Error(`Unknown program id: ${programId}`);
    }

    this.id = program.id;
    this.displayName = program.name;
    this.programType = program.type;
  }

  async isEnabled(): Promise<boolean> {
    const result = await chrome.storage.sync.get(StorageKey.SETTINGS);
    const stored = (result[StorageKey.SETTINGS] as Partial<typeof DEFAULT_SETTINGS> | undefined) ?? undefined;
    const settings = mergeSettings(stored);

    if (settings.enabledPrograms.length === 0) {
      return true;
    }
    return settings.enabledPrograms.includes(this.id);
  }

  buildActivationUrl(_storeKey: string, merchantUrl: string): Promise<string> {
    const program = getProgramById(this.id);
    // TODO: replace with real activation endpoints — loginUrl/signupUrl are placeholders
    const baseUrl = program?.activationBaseUrl ?? program?.loginUrl ?? program?.signupUrl;
    return Promise.resolve(buildGenericActivationUrl(baseUrl, merchantUrl));
  }

  detectAttributionRisk(merchantUrl: string): Promise<'none' | 'possible_affiliate_tag'> {
    const url = new URL(merchantUrl);
    const hasTracking = ['tag', 'affiliate', 'ref', 'utm_source'].some((key) => url.searchParams.has(key));
    return Promise.resolve(hasTracking ? 'possible_affiliate_tag' : 'none');
  }

  async refreshMerchantDomains(): Promise<string[] | null> {
    const program = getProgramById(this.id);
    const apiBaseUrl = program?.loginUrl ?? program?.signupUrl;
    if (!apiBaseUrl) {
      return DEFAULT_PROGRAM_MERCHANT_DOMAINS[this.id] ?? null;
    }

    try {
      const url = new URL('/api/extension/merchant-domains', apiBaseUrl);
      const response = await withTimeout(fetch(url.toString()), OFFER_REFRESH_TIMEOUT_MS);
      if (!response.ok) {
        return DEFAULT_PROGRAM_MERCHANT_DOMAINS[this.id] ?? null;
      }
      const payload = (await response.json()) as { domains?: string[] };
      if (!Array.isArray(payload.domains) || payload.domains.length === 0) {
        return DEFAULT_PROGRAM_MERCHANT_DOMAINS[this.id] ?? null;
      }
      return payload.domains.map(normalizeHostname);
    } catch {
      return DEFAULT_PROGRAM_MERCHANT_DOMAINS[this.id] ?? null;
    }
  }

  async refreshOffer(storeKey: string): Promise<OfferSnapshot | null> {
    const program = getProgramById(this.id);
    const apiBaseUrl = program?.loginUrl ?? program?.signupUrl;
    if (!apiBaseUrl) {
      return null;
    }

    try {
      const url = new URL(`/api/extension/offers?domain=${encodeURIComponent(storeKey)}`, apiBaseUrl);
      const response = await withTimeout(fetch(url.toString()), OFFER_REFRESH_TIMEOUT_MS);
      if (!response.ok || !program) {
        return null;
      }
      const payload = (await response.json()) as { pointsPerDollar?: number };
      if (typeof payload.pointsPerDollar !== 'number' || Number.isNaN(payload.pointsPerDollar)) {
        return null;
      }

      return {
        storeKey,
        pointsPerDollar: payload.pointsPerDollar,
        currency: program.currency,
        fetchedAt: Date.now(),
      };
    } catch {
      return null;
    }
  }
}

const adapterCache = new Map<string, ProgramAdapter>();

export function getAdapter(programId: string): ProgramAdapter {
  const cached = adapterCache.get(programId);
  if (cached) {
    return cached;
  }
  const adapter = new GenericProgramAdapter(programId);
  adapterCache.set(programId, adapter);
  return adapter;
}
