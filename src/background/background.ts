import {
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
  return { ...DEFAULT_SETTINGS, ...stored };
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

/** Finds shopping opportunities for a given URL */
export async function findOpportunities(
  url: string
): Promise<ShoppingOpportunity[]> {
  const settings = await getSettings();
  const program = findProgramForUrl(url);

  if (!program) {
    return [];
  }

  if (
    settings.enabledPrograms.length > 0 &&
    !settings.enabledPrograms.includes(program.id)
  ) {
    return [];
  }

  const estimatedPoints = calculateEstimatedPoints(program);
  if (estimatedPoints < settings.minimumPointsThreshold) {
    return [];
  }

  return [
    {
      url,
      retailerName: program.name,
      estimatedPoints,
      programId: program.id,
    },
  ];
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
        .catch(console.error);
      return true; // Keep message channel open for async response

    case MessageType.GET_BALANCES:
      getStoredBalances()
        .then((balances) => {
          sendResponse({
            type: MessageType.BALANCES_RESULT,
            balances,
          });
        })
        .catch(console.error);
      return true;

    case MessageType.UPDATE_BALANCE:
      upsertBalance(message.balance)
        .then(() => {
          sendResponse({
            type: MessageType.BALANCES_RESULT,
            balances: [],
          });
        })
        .catch(console.error);
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
  if (details.reason === 'install') {
    console.log('Points Plugin installed');
    void chrome.storage.sync.set({ [StorageKey.SETTINGS]: DEFAULT_SETTINGS });
  } else if (details.reason === 'update') {
    console.log(`Points Plugin updated to version ${details.previousVersion ?? 'unknown'}`);
  }
}

// Register event listeners (only when running as actual extension)
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener(handleMessage);
  chrome.runtime.onInstalled.addListener(handleInstalled);
}
