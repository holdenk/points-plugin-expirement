import {
  Settings,
  StorageKey,
  DEFAULT_SETTINGS,
  KNOWN_PROGRAMS,
} from '../types/index';

/** Gets settings from storage */
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

/** Saves settings to storage */
export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [StorageKey.SETTINGS]: settings });
}

/** Reads the current form values into a Settings object */
export function readFormValues(): Settings {
  const notificationsEl = document.getElementById(
    'enable-notifications'
  ) as HTMLInputElement | null;
  const minPointsEl = document.getElementById(
    'min-points'
  ) as HTMLInputElement | null;

  const enabledPrograms: string[] = [];
  const pointValuationsCents: Record<string, number> = {};

  KNOWN_PROGRAMS.forEach((program) => {
    const checkbox = document.getElementById(
      `program-${program.id}`
    ) as HTMLInputElement | null;
    if (checkbox?.checked) {
      enabledPrograms.push(program.id);
    }

    const valuationInput = document.getElementById(
      `valuation-${program.id}`
    ) as HTMLInputElement | null;
    const defaultValuation = DEFAULT_SETTINGS.pointValuationsCents[program.id] ?? 1;
    const parsedValuation = parseFloat(valuationInput?.value ?? '');
    pointValuationsCents[program.id] = Number.isNaN(parsedValuation)
      ? defaultValuation
      : parsedValuation;
  });

  const parsedMinPoints = parseInt(minPointsEl?.value ?? '', 10);

  return {
    enableNotifications: notificationsEl?.checked ?? DEFAULT_SETTINGS.enableNotifications,
    minimumPointsThreshold: Number.isNaN(parsedMinPoints)
      ? DEFAULT_SETTINGS.minimumPointsThreshold
      : parsedMinPoints,
    enabledPrograms,
    onboardingCompleted: true,
    pointValuationsCents,
  };
}

/** Populates the form with the given settings */
export function populateForm(settings: Settings): void {
  const notificationsEl = document.getElementById(
    'enable-notifications'
  ) as HTMLInputElement | null;
  const minPointsEl = document.getElementById(
    'min-points'
  ) as HTMLInputElement | null;
  const programsList = document.getElementById('programs-list');

  if (notificationsEl) notificationsEl.checked = settings.enableNotifications;
  if (minPointsEl)
    minPointsEl.value = String(settings.minimumPointsThreshold);

  if (programsList) {
    programsList.innerHTML = '';
    KNOWN_PROGRAMS.forEach((program) => {
      const row = document.createElement('div');
      row.className = 'program-row';

      const label = document.createElement('label');
      label.className = 'checkbox-label';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `program-${program.id}`;
      checkbox.checked =
        settings.enabledPrograms.length === 0 ||
        settings.enabledPrograms.includes(program.id);

      label.appendChild(checkbox);
      label.appendChild(document.createTextNode(program.name));

      const valuation = document.createElement('input');
      valuation.type = 'number';
      valuation.step = '0.1';
      valuation.min = '0';
      valuation.id = `valuation-${program.id}`;
      valuation.value = String(settings.pointValuationsCents[program.id] ?? 1);
      valuation.className = 'valuation-input';
      valuation.setAttribute('aria-label', `${program.name} point value (cents)`);

      row.appendChild(label);
      row.appendChild(valuation);
      programsList.appendChild(row);
    });
  }
}

/** Initializes the options page */
export async function initOptions(): Promise<void> {
  const settings = await getSettings();
  populateForm(settings);

  const form = document.getElementById('settings-form');
  const statusEl = document.getElementById('status');
  const addProgramButton = document.getElementById('add-program');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const newSettings = readFormValues();
    void saveSettings(newSettings).then(() => {
      if (statusEl) {
        statusEl.style.display = 'block';
        setTimeout(() => {
          statusEl.style.display = 'none';
        }, 2000);
      }
    });
  });

  addProgramButton?.addEventListener('click', () => {
    KNOWN_PROGRAMS.forEach((program) => {
      const checkbox = document.getElementById(`program-${program.id}`) as HTMLInputElement | null;
      if (checkbox) {
        checkbox.checked = true;
      }
    });
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    void initOptions();
  });
}
