import {
  AlternateEarningMethod,
  DEFAULT_SETTINGS,
  KNOWN_PROGRAMS,
  ProgramAdapter,
  Settings,
  StorageKey,
} from '../types/index';

function getProgramById(programId: string): (typeof KNOWN_PROGRAMS)[number] | undefined {
  return KNOWN_PROGRAMS.find((program) => program.id === programId);
}

function buildGenericActivationUrl(baseUrl: string | undefined, merchantUrl: string): string {
  if (!baseUrl) {
    throw new Error('Missing activation base URL for program');
  }
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}target=${encodeURIComponent(merchantUrl)}`;
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
    const stored = (result[StorageKey.SETTINGS] as Partial<Settings> | undefined) ?? undefined;
    const settings: Settings = {
      ...DEFAULT_SETTINGS,
      ...stored,
      pointValuationsCents: {
        ...DEFAULT_SETTINGS.pointValuationsCents,
        ...stored?.pointValuationsCents,
      },
    };

    if (settings.enabledPrograms.length === 0) {
      return true;
    }
    return settings.enabledPrograms.includes(this.id);
  }

  buildActivationUrl(_storeKey: string, merchantUrl: string): Promise<string> {
    const program = getProgramById(this.id);
    return Promise.resolve(buildGenericActivationUrl(program?.loginUrl ?? program?.signupUrl, merchantUrl));
  }

  detectAttributionRisk(merchantUrl: string): Promise<'none' | 'possible_affiliate_tag'> {
    const url = new URL(merchantUrl);
    const hasTracking = ['tag', 'affiliate', 'ref', 'utm_source'].some((key) => url.searchParams.has(key));
    return Promise.resolve(hasTracking ? 'possible_affiliate_tag' : 'none');
  }
}

export class FetchAdapter extends GenericProgramAdapter {
  constructor() {
    super('fetch');
  }

  getAlternateEarningMethods(): Promise<AlternateEarningMethod[]> {
    return Promise.resolve([
      {
        type: 'receipt_scanning',
        description: 'Earn points by scanning receipts in the Fetch mobile app.',
        actionUrl: 'https://fetch.com/app',
      },
    ]);
  }
}

export function getAdapter(programId: string): ProgramAdapter {
  if (programId === 'fetch') {
    return new FetchAdapter();
  }
  return new GenericProgramAdapter(programId);
}
