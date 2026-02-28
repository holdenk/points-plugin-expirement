import { readFormValues, populateForm, getSettings, saveSettings } from '../src/options/options';
import { DEFAULT_SETTINGS, KNOWN_PROGRAMS, StorageKey } from '../src/types/index';

describe('populateForm', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="checkbox" id="enable-notifications" />
      <input type="number" id="min-points" />
      <div id="programs-list"></div>
    `;
  });

  it('sets checkbox state from settings', () => {
    populateForm({ ...DEFAULT_SETTINGS, enableNotifications: false });
    const checkbox = document.getElementById('enable-notifications') as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
  });

  it('sets min points from settings', () => {
    populateForm({ ...DEFAULT_SETTINGS, minimumPointsThreshold: 250 });
    const input = document.getElementById('min-points') as HTMLInputElement;
    expect(input.value).toBe('250');
  });

  it('creates checkboxes for known programs', () => {
    populateForm(DEFAULT_SETTINGS);
    const programsList = document.getElementById('programs-list')!;
    const checkboxes = programsList.querySelectorAll('input[type="checkbox"]');
    expect(checkboxes.length).toBe(KNOWN_PROGRAMS.length);
  });

  it('checks all programs when enabledPrograms is empty (all enabled)', () => {
    populateForm({ ...DEFAULT_SETTINGS, enabledPrograms: [] });
    KNOWN_PROGRAMS.forEach((program) => {
      const cb = document.getElementById(`program-${program.id}`) as HTMLInputElement;
      expect(cb.checked).toBe(true);
    });
  });

  it('only checks specified programs', () => {
    populateForm({ ...DEFAULT_SETTINGS, enabledPrograms: ['amazon-rewards'] });
    const amazonCb = document.getElementById('program-amazon-rewards') as HTMLInputElement;
    const targetCb = document.getElementById('program-target-circle') as HTMLInputElement;
    expect(amazonCb.checked).toBe(true);
    expect(targetCb.checked).toBe(false);
  });
});

describe('readFormValues', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="checkbox" id="enable-notifications" checked />
      <input type="number" id="min-points" value="150" />
      <div id="programs-list">
        ${KNOWN_PROGRAMS.map((p) => `<input type="checkbox" id="program-${p.id}" checked />`).join('')}
      </div>
    `;
  });

  it('reads notifications checkbox', () => {
    const values = readFormValues();
    expect(values.enableNotifications).toBe(true);
  });

  it('reads min points value', () => {
    const values = readFormValues();
    expect(values.minimumPointsThreshold).toBe(150);
  });

  it('reads enabled programs from checked checkboxes', () => {
    const values = readFormValues();
    expect(values.enabledPrograms).toEqual(KNOWN_PROGRAMS.map((p) => p.id));
  });

  it('handles unchecked programs', () => {
    const targetCb = document.getElementById('program-target-circle') as HTMLInputElement;
    targetCb.checked = false;
    const values = readFormValues();
    expect(values.enabledPrograms).not.toContain('target-circle');
  });
});

describe('getSettings and saveSettings', () => {
  it('saves and retrieves settings', async () => {
    const settings = { ...DEFAULT_SETTINGS, minimumPointsThreshold: 500 };
    await saveSettings(settings);
    const retrieved = await getSettings();
    expect(retrieved.minimumPointsThreshold).toBe(500);
  });

  it('returns defaults when nothing is stored', async () => {
    const settings = await getSettings();
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });
});
