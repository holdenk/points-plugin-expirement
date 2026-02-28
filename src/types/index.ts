/** The type of reward currency a program uses */
export enum CurrencyType {
  POINTS = 'points',
  PERCENT = 'percent',
  CASHBACK = 'cashback',
}

/** Represents a points program at a retailer */
export interface PointsProgram {
  id: string;
  name: string;
  retailerDomain: string;
  pointsPerDollar: number;
  currency: CurrencyType;
}

/** Represents the user's balance in a points program */
export interface PointsBalance {
  programId: string;
  balance: number;
  lastUpdated: number; // Unix timestamp in ms
}

/** Represents a detected shopping opportunity on a page */
export interface ShoppingOpportunity {
  url: string;
  retailerName: string;
  estimatedPoints: number;
  programId: string;
}

/** Message types for communication between extension components */
export enum MessageType {
  GET_OPPORTUNITIES = 'GET_OPPORTUNITIES',
  OPPORTUNITIES_RESULT = 'OPPORTUNITIES_RESULT',
  GET_BALANCES = 'GET_BALANCES',
  BALANCES_RESULT = 'BALANCES_RESULT',
  UPDATE_BALANCE = 'UPDATE_BALANCE',
  CONTENT_LOADED = 'CONTENT_LOADED',
}

/** Base message interface */
export interface BaseMessage {
  type: MessageType;
}

/** Message sent to request shopping opportunities for a URL */
export interface GetOpportunitiesMessage extends BaseMessage {
  type: MessageType.GET_OPPORTUNITIES;
  url: string;
}

/** Message containing detected shopping opportunities */
export interface OpportunitiesResultMessage extends BaseMessage {
  type: MessageType.OPPORTUNITIES_RESULT;
  opportunities: ShoppingOpportunity[];
}

/** Message sent to request all point balances */
export interface GetBalancesMessage extends BaseMessage {
  type: MessageType.GET_BALANCES;
}

/** Message containing point balances */
export interface BalancesResultMessage extends BaseMessage {
  type: MessageType.BALANCES_RESULT;
  balances: PointsBalance[];
}

/** Message to update a specific balance */
export interface UpdateBalanceMessage extends BaseMessage {
  type: MessageType.UPDATE_BALANCE;
  balance: PointsBalance;
}

/** Message sent when content script is loaded */
export interface ContentLoadedMessage extends BaseMessage {
  type: MessageType.CONTENT_LOADED;
  url: string;
}

/** Union of all message types */
export type ExtensionMessage =
  | GetOpportunitiesMessage
  | OpportunitiesResultMessage
  | GetBalancesMessage
  | BalancesResultMessage
  | UpdateBalanceMessage
  | ContentLoadedMessage;

/** Storage keys used by the extension */
export enum StorageKey {
  PROGRAMS = 'programs',
  BALANCES = 'balances',
  SETTINGS = 'settings',
}

/** Extension settings */
export interface Settings {
  enableNotifications: boolean;
  minimumPointsThreshold: number;
  enabledPrograms: string[];
}

/** Default settings */
export const DEFAULT_SETTINGS: Settings = {
  enableNotifications: true,
  minimumPointsThreshold: 100,
  enabledPrograms: [],
};

/** Known points programs */
export const KNOWN_PROGRAMS: PointsProgram[] = [
  {
    id: 'amazon-rewards',
    name: 'Amazon Rewards',
    retailerDomain: 'amazon.com',
    pointsPerDollar: 3,
    currency: CurrencyType.POINTS,
  },
  {
    id: 'target-circle',
    name: 'Target Circle',
    retailerDomain: 'target.com',
    pointsPerDollar: 1,
    currency: CurrencyType.PERCENT,
  },
  {
    id: 'walmart-rewards',
    name: 'Walmart Rewards',
    retailerDomain: 'walmart.com',
    pointsPerDollar: 5,
    currency: CurrencyType.CASHBACK,
  },
];
