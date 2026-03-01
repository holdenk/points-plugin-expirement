import {
  ActivationUrlResultMessage,
  ExtensionMessage,
  MessageType,
  PointsBalance,
  PointsProgram,
  Settings,
  ShoppingOpportunity,
  StorageKey,
  DEFAULT_SETTINGS,
  KNOWN_PROGRAMS,
} from '../types/index';
import { getAdapter } from './adapters';


const KNOWN_MERCHANT_DOMAINS = [
  'amazon.com',
  'bestbuy.com',
  'ebay.com',
  'etsy.com',
  'homedepot.com',
  'lowes.com',
  'macys.com',
  'nike.com',
  'target.com',
  'walmart.com',
];

function isKnownMerchantHost(hostname: string): boolean {
  return KNOWN_MERCHANT_DOMAINS.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
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
  estimatedSpend: number = 50
): number {
  return Math.floor(program.pointsPerDollar * estimatedSpend);
}

/**
 * Finds shopping opportunities for a merchant URL.
 * This is intentionally catalog-first and does not scrape merchant pages.
 */
export async function findOpportunities(
  url: string
): Promise<ShoppingOpportunity[]> {
  let merchantHost: string;
  try {
    merchantHost = new URL(url).hostname;
  } catch {
    return [];
  }

  if (!isKnownMerchantHost(merchantHost)) {
    return [];
  }

  const settings = await getSettings();
  const enabledPrograms = settings.enabledPrograms.length > 0
    ? KNOWN_PROGRAMS.filter((program) => settings.enabledPrograms.includes(program.id))
    : KNOWN_PROGRAMS;

  const opportunities = enabledPrograms
    .filter((program) => !merchantHost.includes(program.retailerDomain))
    .map((program) => {
      const estimatedPoints = calculateEstimatedPoints(program);
      const valuation = settings.pointValuationsCents[program.id] ?? 1;

      return {
        url,
        retailerName: program.name,
        estimatedPoints,
        estimatedValueCents: Math.round(estimatedPoints * valuation),
        programId: program.id,
      };
    })
    .filter((opportunity) => opportunity.estimatedPoints >= settings.minimumPointsThreshold)
    .sort((a, b) => (b.estimatedValueCents ?? 0) - (a.estimatedValueCents ?? 0));

  return opportunities.slice(0, 5);
}

export async function buildActivationUrl(programId: string, merchantUrl: string): Promise<ActivationUrlResultMessage> {
  let storeKey: string;
  try {
    storeKey = new URL(merchantUrl).hostname.replace(/^www\./, '');
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

if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.runtime.onInstalled.addListener(handleInstalled);
}
