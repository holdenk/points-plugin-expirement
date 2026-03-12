/** The type of reward currency a program uses */
export enum CurrencyType {
  POINTS = 'points',
  PERCENT = 'percent',
  CASHBACK = 'cashback',
}

export type ProgramType = 'airline' | 'cashback' | 'coupon';

/** Represents a points program at a retailer */
export interface PointsProgram {
  id: string;
  name: string;
  retailerDomain: string;
  pointsPerDollar: number;
  currency: CurrencyType;
  type: ProgramType;
  signupUrl?: string;
  loginUrl?: string;
  // TODO: replace with real activation endpoints per program
  activationBaseUrl?: string;
}

export interface OfferSnapshot {
  storeKey: string;
  pointsPerDollar: number;
  currency: CurrencyType;
  fetchedAt: number;
}


/**
 * Interface for program-specific activation and offer logic.
 * Activation URLs MUST only be built after explicit user click.
 */
export interface ProgramAdapter {
  id: string;
  displayName: string;
  programType: ProgramType;
  isEnabled(): Promise<boolean>;
  buildActivationUrl(storeKey: string, merchantUrl: string): Promise<string>;
  refreshOffer?(storeKey: string): Promise<OfferSnapshot | null>;
  refreshMerchantDomains?(): Promise<string[] | null>;
  detectAttributionRisk?(merchantUrl: string): Promise<'none' | 'possible_affiliate_tag'>;
}

/** Represents the user's balance in a points program */
export interface PointsBalance {
  programId: string;
  balance: number;
  lastUpdated: number;
}

/** Represents a detected shopping opportunity on a page */
export interface ShoppingOpportunity {
  url: string;
  programName: string;
  estimatedPoints: number;
  estimatedValueCents?: number;
  programId: string;
}

/** Message types for communication between extension components */
export enum MessageType {
  GET_OPPORTUNITIES = 'GET_OPPORTUNITIES',
  OPPORTUNITIES_RESULT = 'OPPORTUNITIES_RESULT',
  BUILD_ACTIVATION_URL = 'BUILD_ACTIVATION_URL',
  ACTIVATION_URL_RESULT = 'ACTIVATION_URL_RESULT',
  GET_BALANCES = 'GET_BALANCES',
  BALANCES_RESULT = 'BALANCES_RESULT',
  UPDATE_BALANCE = 'UPDATE_BALANCE',
  CONTENT_LOADED = 'CONTENT_LOADED',
}

/** Base message interface */
export interface BaseMessage {
  type: MessageType;
}

export interface GetOpportunitiesMessage extends BaseMessage {
  type: MessageType.GET_OPPORTUNITIES;
  url: string;
  pagePrice?: number;
}

export interface OpportunitiesResultMessage extends BaseMessage {
  type: MessageType.OPPORTUNITIES_RESULT;
  opportunities: ShoppingOpportunity[];
}

export interface BuildActivationUrlMessage extends BaseMessage {
  type: MessageType.BUILD_ACTIVATION_URL;
  programId: string;
  merchantUrl: string;
}

export interface ActivationUrlResultMessage extends BaseMessage {
  type: MessageType.ACTIVATION_URL_RESULT;
  programId: string;
  activationUrl: string;
  attributionRisk: 'none' | 'possible_affiliate_tag';
  error?: string;
}

export interface GetBalancesMessage extends BaseMessage {
  type: MessageType.GET_BALANCES;
}

export interface BalancesResultMessage extends BaseMessage {
  type: MessageType.BALANCES_RESULT;
  balances: PointsBalance[];
}

export interface UpdateBalanceMessage extends BaseMessage {
  type: MessageType.UPDATE_BALANCE;
  balance: PointsBalance;
}

export interface ContentLoadedMessage extends BaseMessage {
  type: MessageType.CONTENT_LOADED;
  url: string;
}

export type ExtensionMessage =
  | GetOpportunitiesMessage
  | OpportunitiesResultMessage
  | BuildActivationUrlMessage
  | ActivationUrlResultMessage
  | GetBalancesMessage
  | BalancesResultMessage
  | UpdateBalanceMessage
  | ContentLoadedMessage;

export enum StorageKey {
  PROGRAMS = 'programs',
  BALANCES = 'balances',
  SETTINGS = 'settings',
  OPPORTUNITY_CACHE = 'opportunity_cache',
}

export interface Settings {
  enableNotifications: boolean;
  minimumPointsThreshold: number;
  enabledPrograms: string[];
  onboardingCompleted: boolean;
  pointValuationsCents: Record<string, number>;
}

export const DEFAULT_SETTINGS: Settings = {
  enableNotifications: true,
  minimumPointsThreshold: 100,
  enabledPrograms: [],
  onboardingCompleted: false,
  pointValuationsCents: {
    'aa-eshopping': 1.4,
    'united-shopping': 1.2,
    'alaska-atmos': 1.3,
    'delta-skymiles-shopping': 1.2,
    'jetblue-trueblue-shopping': 1.3,
    'southwest-shopping': 1.4,
    rakuten: 1,
    'capital-one-shopping': 1,
    'mr-rebates': 1,
  },
};

/** Normalizes a hostname by stripping www. prefix and lowercasing */
export function normalizeHostname(hostname: string): string {
  return hostname.replace(/^www\./, '').toLowerCase();
}

/** Finds a known program by its ID */
export function getProgramById(programId: string): PointsProgram | undefined {
  return KNOWN_PROGRAMS.find((program) => program.id === programId);
}

/** Merges partial stored settings with defaults, preserving nested pointValuationsCents */
export function mergeSettings(stored: Partial<Settings> | undefined): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    pointValuationsCents: {
      ...DEFAULT_SETTINGS.pointValuationsCents,
      ...stored?.pointValuationsCents,
    },
  };
}

export const KNOWN_PROGRAMS: PointsProgram[] = [
  {
    id: 'aa-eshopping',
    name: 'AA AAdvantage eShopping',
    retailerDomain: 'aadvantageeshopping.com',
    pointsPerDollar: 2,
    currency: CurrencyType.POINTS,
    type: 'airline',
    signupUrl: 'https://www.aadvantageeshopping.com/',
    loginUrl: 'https://www.aadvantageeshopping.com/',
  },
  {
    id: 'united-shopping',
    name: 'United MileagePlus Shopping',
    retailerDomain: 'shopping.mileageplus.com',
    pointsPerDollar: 2,
    currency: CurrencyType.POINTS,
    type: 'airline',
    signupUrl: 'https://shopping.mileageplus.com/',
    loginUrl: 'https://shopping.mileageplus.com/',
  },
  {
    id: 'alaska-atmos',
    name: 'Alaska Airlines Atmos Rewards',
    retailerDomain: 'atmosrewards.com',
    pointsPerDollar: 2,
    currency: CurrencyType.POINTS,
    type: 'airline',
    signupUrl: 'https://www.atmosrewards.com/',
    loginUrl: 'https://www.atmosrewards.com/',
  },
  {
    id: 'delta-skymiles-shopping',
    name: 'Delta SkyMiles Shopping',
    retailerDomain: 'skymilesshopping.com',
    pointsPerDollar: 2,
    currency: CurrencyType.POINTS,
    type: 'airline',
  },
  {
    id: 'jetblue-trueblue-shopping',
    name: 'JetBlue TrueBlue Shopping',
    retailerDomain: 'trueblueshopping.jetblue.com',
    pointsPerDollar: 2,
    currency: CurrencyType.POINTS,
    type: 'airline',
  },
  {
    id: 'southwest-shopping',
    name: 'Southwest Rapid Rewards Shopping',
    retailerDomain: 'rapidrewardsshopping.southwest.com',
    pointsPerDollar: 2,
    currency: CurrencyType.POINTS,
    type: 'airline',
  },
  {
    id: 'rakuten',
    name: 'Rakuten',
    retailerDomain: 'rakuten.com',
    pointsPerDollar: 1,
    currency: CurrencyType.CASHBACK,
    type: 'cashback',
    signupUrl: 'https://www.rakuten.com/',
    loginUrl: 'https://www.rakuten.com/',
  },
  {
    id: 'capital-one-shopping',
    name: 'Capital One Shopping',
    retailerDomain: 'capitaloneshopping.com',
    pointsPerDollar: 1,
    currency: CurrencyType.CASHBACK,
    type: 'cashback',
    signupUrl: 'https://capitaloneshopping.com/',
    loginUrl: 'https://capitaloneshopping.com/',
  },
  {
    id: 'mr-rebates',
    name: 'Mr. Rebates',
    retailerDomain: 'mrrebates.com',
    pointsPerDollar: 1,
    currency: CurrencyType.CASHBACK,
    type: 'cashback',
    signupUrl: 'https://www.mrrebates.com/',
    loginUrl: 'https://www.mrrebates.com/',
  },
];
