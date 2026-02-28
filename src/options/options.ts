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
  return { ...DEFAULT_SETTINGS, ...stored };
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
  KNOWN_PROGRAMS.forEach((program) => {
    const checkbox = document.getElementById(
      `program-${program.id}`
    ) as HTMLInputElement | null;
    if (checkbox?.checked) {
      enabledPrograms.push(program.id);
    }
  });

  return {
    enableNotifications: notificationsEl?.checked ?? DEFAULT_SETTINGS.enableNotifications,
    minimumPointsThreshold: parseInt(minPointsEl?.value ?? '0', 10) || DEFAULT_SETTINGS.minimumPointsThreshold,
    enabledPrograms,
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
      programsList.appendChild(label);
    });
  }
}

/** Initializes the options page */
export async function initOptions(): Promise<void> {
  const settings = await getSettings();
  populateForm(settings);

  const form = document.getElementById('settings-form');
  const statusEl = document.getElementById('status');

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
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    void initOptions();
  });
}
