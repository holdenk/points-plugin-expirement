import {
  ActivationUrlResultMessage,
  ExtensionMessage,
  MessageType,
  OfferSnapshot,
  PointsBalance,
  PointsProgram,
  Settings,
  ShoppingOpportunity,
  StorageKey,
  DEFAULT_SETTINGS,
  KNOWN_PROGRAMS,
} from '../types/index';
import { getAdapter } from './adapters';

const OPPORTUNITY_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedDomainsEntry {
  domains: string[];
  fetchedAt: number;
}

interface CachedOfferEntry {
  pointsPerDollar: number;
  fetchedAt: number;
}

interface OpportunityCache {
  merchantDomainsByProgram: Record<string, CachedDomainsEntry>;
  offersByProgramAndStore: Record<string, Record<string, CachedOfferEntry>>;
}

let inMemoryOpportunityCache: OpportunityCache | null = null;
const inFlightDomainRefresh = new Map<string, Promise<void>>();
const inFlightOfferRefresh = new Map<string, Promise<void>>();

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
}

function hasActiveTracking(merchantUrl: string): boolean {
  try {
    const url = new URL(merchantUrl);
    return ['tag', 'affiliate', 'ref', 'utm_source'].some((key) => url.searchParams.has(key));
  } catch {
    return false;
  }
}

function isFresh(timestamp: number): boolean {
  return Date.now() - timestamp <= OPPORTUNITY_CACHE_TTL_MS;
}

function cloneOpportunityCache(cache: OpportunityCache): OpportunityCache {
  return {
    merchantDomainsByProgram: { ...cache.merchantDomainsByProgram },
    offersByProgramAndStore: Object.fromEntries(
      Object.entries(cache.offersByProgramAndStore).map(([programId, storeMap]) => [
        programId,
        { ...storeMap },
      ])
    ),
  };
}

async function getOpportunityCache(): Promise<OpportunityCache> {
  if (inMemoryOpportunityCache) {
    return inMemoryOpportunityCache;
  }

  const result = await chrome.storage.local.get(StorageKey.OPPORTUNITY_CACHE);
  const stored = result[StorageKey.OPPORTUNITY_CACHE] as Partial<OpportunityCache> | undefined;

  inMemoryOpportunityCache = {
    merchantDomainsByProgram: stored?.merchantDomainsByProgram ?? {},
    offersByProgramAndStore: stored?.offersByProgramAndStore ?? {},
  };

  return inMemoryOpportunityCache;
}

async function persistOpportunityCache(cache: OpportunityCache): Promise<void> {
  inMemoryOpportunityCache = cloneOpportunityCache(cache);
  await chrome.storage.local.set({ [StorageKey.OPPORTUNITY_CACHE]: inMemoryOpportunityCache });
}

async function refreshProgramDomains(programId: string): Promise<void> {
  if (inFlightDomainRefresh.has(programId)) {
    return inFlightDomainRefresh.get(programId)!;
  }

  const refreshPromise = (async (): Promise<void> => {
    const adapter = getAdapter(programId);
    const refreshedDomains = await adapter.refreshMerchantDomains?.();
    if (!refreshedDomains || refreshedDomains.length === 0) {
      return;
    }

    const cache = await getOpportunityCache();
    cache.merchantDomainsByProgram[programId] = {
      domains: refreshedDomains.map(normalizeHostname),
      fetchedAt: Date.now(),
    };
    await persistOpportunityCache(cache);
  })()
    .catch((error) => {
      console.error(error);
    })
    .finally(() => {
      inFlightDomainRefresh.delete(programId);
    });

  inFlightDomainRefresh.set(programId, refreshPromise);
  return refreshPromise;
}

async function refreshProgramOffer(programId: string, storeKey: string): Promise<void> {
  const refreshKey = `${programId}:${storeKey}`;
  if (inFlightOfferRefresh.has(refreshKey)) {
    return inFlightOfferRefresh.get(refreshKey)!;
  }

  const refreshPromise = (async (): Promise<void> => {
    const adapter = getAdapter(programId);
    const refreshedOffer = await adapter.refreshOffer?.(storeKey);
    if (!refreshedOffer) {
      return;
    }

    const cache = await getOpportunityCache();
    const programOffers = cache.offersByProgramAndStore[programId] ?? {};
    programOffers[storeKey] = {
      pointsPerDollar: refreshedOffer.pointsPerDollar,
      fetchedAt: refreshedOffer.fetchedAt,
    };
    cache.offersByProgramAndStore[programId] = programOffers;
    await persistOpportunityCache(cache);
  })()
    .catch((error) => {
      console.error(error);
    })
    .finally(() => {
      inFlightOfferRefresh.delete(refreshKey);
    });

  inFlightOfferRefresh.set(refreshKey, refreshPromise);
  return refreshPromise;
}

async function getCachedDomainsForProgram(programId: string): Promise<string[] | null> {
  const cache = await getOpportunityCache();
  const cached = cache.merchantDomainsByProgram[programId];

  if (!cached) {
    void refreshProgramDomains(programId);
    return null;
  }

  if (!isFresh(cached.fetchedAt)) {
    void refreshProgramDomains(programId);
  }

  return cached.domains;
}

async function getCachedOfferForProgram(
  program: PointsProgram,
  storeKey: string
): Promise<OfferSnapshot | null> {
  const cache = await getOpportunityCache();
  const cached = cache.offersByProgramAndStore[program.id]?.[storeKey];

  if (!cached) {
    void refreshProgramOffer(program.id, storeKey);
    return null;
  }

  if (!isFresh(cached.fetchedAt)) {
    void refreshProgramOffer(program.id, storeKey);
  }

  return {
    storeKey,
    pointsPerDollar: cached.pointsPerDollar,
    currency: program.currency,
    fetchedAt: cached.fetchedAt,
  };
}

/** Gets stored point balances from extension storage */
export async function getStoredBalances(): Promise<PointsBalance[]> {
  const result = await chrome.storage.local.get(StorageKey.BALANCES);
  return (result[StorageKey.BALANCES] as PointsBalance[]) ?? [];
}

/** Saves point balances to extension storage */
export async function saveBalances(balances: PointsBalance[]): Promise<void> {
  await chrome.storage.local.set({ [StorageKey.BALANCES]: balances });
}

/** Updates or inserts a single balance */
export async function upsertBalance(newBalance: PointsBalance): Promise<void> {
  const balances = await getStoredBalances();
  const index = balances.findIndex((b) => b.programId === newBalance.programId);
  if (index >= 0) {
    balances[index] = newBalance;
  } else {
    balances.push(newBalance);
  }
  await saveBalances(balances);
}

/** Gets extension settings from storage */
export async function getSettings(): Promise<Settings> {
  const result = await chrome.storage.sync.get(StorageKey.SETTINGS);
  const stored = result[StorageKey.SETTINGS] as Partial<Settings> | undefined;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    pointValuationsCents: {
      ...DEFAULT_SETTINGS.pointValuationsCents,
      ...stored?.pointValuationsCents,
    },
  };
}

/** Finds a points program matching the given URL */
export function findProgramForUrl(
  url: string,
  programs: PointsProgram[] = KNOWN_PROGRAMS
): PointsProgram | undefined {
  try {
    const hostname = new URL(url).hostname;
    return programs.find((p) => hostname.includes(p.retailerDomain));
  } catch {
    return undefined;
  }
}

/** Calculates estimated points for a shopping opportunity */
export function calculateEstimatedPoints(
  program: PointsProgram,
  estimatedSpend: number = 50,
  pointsPerDollarOverride?: number
): number {
  const effectiveRate = pointsPerDollarOverride ?? program.pointsPerDollar;
  return Math.floor(effectiveRate * estimatedSpend);
}

async function buildOpportunityForProgram(
  program: PointsProgram,
  merchantHost: string,
  sourceUrl: string,
  settings: Settings
): Promise<ShoppingOpportunity | null> {
  const cachedDomains = await getCachedDomainsForProgram(program.id);
  if (cachedDomains && cachedDomains.length > 0 && !cachedDomains.includes(merchantHost)) {
    return null;
  }

  const cachedOffer = await getCachedOfferForProgram(program, merchantHost);
  const estimatedPoints = calculateEstimatedPoints(program, 50, cachedOffer?.pointsPerDollar);
  if (estimatedPoints < settings.minimumPointsThreshold) {
    return null;
  }

  const valuation = settings.pointValuationsCents[program.id] ?? 1;
  return {
    url: sourceUrl,
    retailerName: program.name,
    estimatedPoints,
    estimatedValueCents: Math.round(estimatedPoints * valuation),
    programId: program.id,
  };
}

/**
 * Finds shopping opportunities for a merchant URL.
 * Uses cache-first lookups and opportunistic refreshes so popup responses stay fast.
 */
export async function findOpportunities(
  url: string
): Promise<ShoppingOpportunity[]> {
  let merchantHost: string;
  try {
    merchantHost = normalizeHostname(new URL(url).hostname);
  } catch {
    return [];
  }

  if (hasActiveTracking(url)) {
    return [];
  }

  const settings = await getSettings();
  const enabledPrograms = settings.enabledPrograms.length > 0
    ? KNOWN_PROGRAMS.filter((program) => settings.enabledPrograms.includes(program.id))
    : KNOWN_PROGRAMS;

  const settled = await Promise.allSettled(
    enabledPrograms.map((program) => buildOpportunityForProgram(program, merchantHost, url, settings))
  );

  const opportunities = settled
    .filter((result): result is PromiseFulfilledResult<ShoppingOpportunity | null> => result.status === 'fulfilled')
    .map((result) => result.value)
    .filter((opportunity): opportunity is ShoppingOpportunity => opportunity != null)
    .sort((a, b) => (b.estimatedValueCents ?? 0) - (a.estimatedValueCents ?? 0));

  return opportunities.slice(0, 5);
}

export async function buildActivationUrl(programId: string, merchantUrl: string): Promise<ActivationUrlResultMessage> {
  let storeKey: string;
  try {
    storeKey = normalizeHostname(new URL(merchantUrl).hostname);
  } catch {
    return {
      type: MessageType.ACTIVATION_URL_RESULT,
      programId,
      activationUrl: '',
      attributionRisk: 'none',
      error: 'Invalid merchant URL',
    };
  }

  try {
    const adapter = getAdapter(programId);
    const activationUrl = await adapter.buildActivationUrl(storeKey, merchantUrl);
    const attributionRisk = adapter.detectAttributionRisk
      ? await adapter.detectAttributionRisk(merchantUrl)
      : 'none';

    return {
      type: MessageType.ACTIVATION_URL_RESULT,
      programId,
      activationUrl,
      attributionRisk,
    }; 
  } catch (error) {
    return {
      type: MessageType.ACTIVATION_URL_RESULT,
      programId,
      activationUrl: '',
      attributionRisk: 'none',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Handles incoming messages from other extension components */
export function handleMessage(
  message: ExtensionMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: ExtensionMessage) => void
): boolean {
  switch (message.type) {
    case MessageType.GET_OPPORTUNITIES:
      findOpportunities(message.url)
        .then((opportunities) => {
          sendResponse({
            type: MessageType.OPPORTUNITIES_RESULT,
            opportunities,
          });
        })
        .catch((error) => {
          console.error(error);
          sendResponse({
            type: MessageType.OPPORTUNITIES_RESULT,
            opportunities: [],
          });
        });
      return true;

    case MessageType.BUILD_ACTIVATION_URL:
      buildActivationUrl(message.programId, message.merchantUrl)
        .then((result) => {
          sendResponse(result);
        })
        .catch((error) => {
          console.error(error);
          sendResponse({
            type: MessageType.ACTIVATION_URL_RESULT,
            programId: message.programId,
            activationUrl: '',
            attributionRisk: 'none',
            error: error instanceof Error ? error.message : String(error),
          });
        });
      return true;

    case MessageType.GET_BALANCES:
      getStoredBalances()
        .then((balances) => {
          sendResponse({
            type: MessageType.BALANCES_RESULT,
            balances,
          });
        })
        .catch((error) => {
          console.error(error);
          sendResponse({
            type: MessageType.BALANCES_RESULT,
            balances: [],
          });
        });
      return true;

    case MessageType.UPDATE_BALANCE:
      upsertBalance(message.balance)
        .then(() => {
          sendResponse({
            type: MessageType.BALANCES_RESULT,
            balances: [],
          });
        })
        .catch((error) => {
          console.error(error);
          sendResponse({
            type: MessageType.BALANCES_RESULT,
            balances: [],
          });
        });
      return true;

    case MessageType.CONTENT_LOADED:
      console.log(`Content script loaded on: ${message.url}`);
      return false;

    default:
      return false;
  }
}

/** Handles extension installation/update */
export function handleInstalled(
  details: chrome.runtime.InstalledDetails
): void {
  const installReason = chrome.runtime.OnInstalledReason?.INSTALL ?? 'install';
  const updateReason = chrome.runtime.OnInstalledReason?.UPDATE ?? 'update';

  if (details.reason === installReason) {
    console.log('Points Plugin installed');
    void chrome.storage.sync.set({ [StorageKey.SETTINGS]: DEFAULT_SETTINGS });
    void chrome.runtime.openOptionsPage();
  } else if (details.reason === updateReason) {
    console.log(`Points Plugin updated from version ${details.previousVersion ?? 'unknown'}`);
  }
}

export function __resetOpportunityCacheForTests(): void {
  inMemoryOpportunityCache = null;
  inFlightDomainRefresh.clear();
  inFlightOfferRefresh.clear();
}

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.runtime.onInstalled.addListener(handleInstalled);
}
