import { readFormValues, populateForm, getSettings, saveSettings } from '../src/options/options';
import { DEFAULT_SETTINGS, KNOWN_PROGRAMS } from '../src/types/index';

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
});

describe('readFormValues', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="checkbox" id="enable-notifications" checked />
      <input type="number" id="min-points" value="150" />
      <div id="programs-list">
        ${KNOWN_PROGRAMS.map((p) => `
          <input type="checkbox" id="program-${p.id}" checked />
          <input type="number" id="valuation-${p.id}" value="1.5" />
        `).join('')}
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

  it('preserves explicit zero values for threshold and valuation', () => {
    const minPoints = document.getElementById('min-points') as HTMLInputElement;
    const unitedValuation = document.getElementById('valuation-united-shopping') as HTMLInputElement;

    minPoints.value = '0';
    unitedValuation.value = '0';

    const values = readFormValues();
    expect(values.minimumPointsThreshold).toBe(0);
    expect(values.pointValuationsCents['united-shopping']).toBe(0);
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
