import {
  initPopup,
  renderOpportunities,
  renderBalances,
  showError,
} from '../src/popup/popup';
import {
  createOpportunityBanner,
  showOpportunities,
} from '../src/content/content';
import { initOptions, populateForm } from '../src/options/options';
import { MessageType, DEFAULT_SETTINGS } from '../src/types';

const SAMPLE_OPPORTUNITY = {
  url: 'https://www.nike.com/',
  retailerName: 'AA AAdvantage eShopping',
  estimatedPoints: 110,
  estimatedValueCents: 154,
  programId: 'aa-eshopping',
};

function setupPopupDOM(): void {
  document.body.innerHTML = `
    <div id="loading"></div>
    <div id="error" style="display:none"></div>
    <section id="opportunities-section" hidden>
      <div id="opportunities-list"></div>
    </section>
    <section id="balances-section" hidden>
      <div id="balances-list"></div>
    </section>
    <a id="options-link" href="#">Options</a>
    <div id="confetti-container" aria-hidden="true"></div>
  `;
}

function mockOpportunitiesAndBalances(
  opportunities: typeof SAMPLE_OPPORTUNITY[],
  balances: { programId: string; balance: number; lastUpdated: number }[] = []
): void {
  chrome.tabs.query = jest.fn(async () => [
    { url: 'https://www.nike.com/' } as chrome.tabs.Tab,
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chrome.runtime.sendMessage = jest.fn(async (message: any) => {
    if (message.type === MessageType.GET_OPPORTUNITIES) {
      return {
        type: MessageType.OPPORTUNITIES_RESULT,
        opportunities,
      };
    }
    if (message.type === MessageType.GET_BALANCES) {
      return {
        type: MessageType.BALANCES_RESULT,
        balances,
      };
    }
    throw new Error(`Unexpected message type: ${message.type as string}`);
  });
}

// ─────────────────────────────────────────────
// 1. Popup Confetti System
// ─────────────────────────────────────────────
describe('Popup confetti system', () => {
  it('spawns confetti on popup load when opportunities exist', async () => {
    setupPopupDOM();
    mockOpportunitiesAndBalances([SAMPLE_OPPORTUNITY]);

    await initPopup();

    const container = document.getElementById('confetti-container')!;
    const pieces = container.querySelectorAll('.confetti-piece');
    expect(pieces.length).toBeGreaterThan(0);
    expect(pieces.length).toBe(30);
  });

  it('does NOT spawn confetti when no opportunities', async () => {
    setupPopupDOM();
    mockOpportunitiesAndBalances([]);

    await initPopup();

    const container = document.getElementById('confetti-container')!;
    expect(container.querySelectorAll('.confetti-piece')).toHaveLength(0);
  });

  it('spawns confetti on activate click', async () => {
    setupPopupDOM();
    const container = document.getElementById('confetti-container')!;
    const oppList = document.getElementById('opportunities-list')!;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    chrome.runtime.sendMessage = jest.fn(async (message: any) => {
      if (message.type === MessageType.BUILD_ACTIVATION_URL) {
        return {
          type: MessageType.ACTIVATION_URL_RESULT,
          programId: 'aa-eshopping',
          activationUrl: 'https://www.aadvantageeshopping.com/?target=https%3A%2F%2Fwww.nike.com%2F',
          attributionRisk: 'none',
        };
      }
      throw new Error(`Unexpected: ${message.type as string}`);
    });

    renderOpportunities([SAMPLE_OPPORTUNITY], oppList);

    const activateBtn = oppList.querySelector('.activate-btn') as HTMLButtonElement;
    activateBtn.click();

    // Flush promises for async activateProgram
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    const pieces = container.querySelectorAll('.confetti-piece');
    expect(pieces.length).toBeGreaterThan(0);
  });

  it('cleans up confetti after timeout', async () => {
    jest.useFakeTimers();
    setupPopupDOM();
    mockOpportunitiesAndBalances([SAMPLE_OPPORTUNITY]);

    await initPopup();

    const container = document.getElementById('confetti-container')!;
    expect(container.querySelectorAll('.confetti-piece').length).toBe(30);

    jest.advanceTimersByTime(2500);
    expect(container.innerHTML).toBe('');

    jest.useRealTimers();
  });

  it('handles missing confetti container gracefully', async () => {
    setupPopupDOM();
    document.getElementById('confetti-container')!.remove();
    mockOpportunitiesAndBalances([SAMPLE_OPPORTUNITY]);

    // Should not throw
    await expect(initPopup()).resolves.toBeUndefined();
  });

  it('each confetti piece has color and position styles', async () => {
    setupPopupDOM();
    mockOpportunitiesAndBalances([SAMPLE_OPPORTUNITY]);

    await initPopup();

    const container = document.getElementById('confetti-container')!;
    const firstPiece = container.querySelector('.confetti-piece') as HTMLElement;
    expect(firstPiece).toBeTruthy();
    expect(firstPiece.style.cssText).toContain('background:');
    expect(firstPiece.style.cssText).toContain('left:');
    expect(firstPiece.style.cssText).toContain('animation:');
  });
});

// ─────────────────────────────────────────────
// 2. Party Text & Theming in Popup
// ─────────────────────────────────────────────
describe('Popup party text and theming', () => {
  it('activate button text says "Activate 🎉"', () => {
    const container = document.createElement('div');
    renderOpportunities([SAMPLE_OPPORTUNITY], container);

    const btn = container.querySelector('.activate-btn') as HTMLButtonElement;
    expect(btn.textContent).toBe('Activate 🎉');
  });

  it('empty opportunities shows party message', () => {
    const container = document.createElement('div');
    renderOpportunities([], container);

    const emptyState = container.querySelector('.empty-state')!;
    expect(emptyState.textContent).toContain('party deals');
  });

  it('empty balances shows party message', () => {
    const container = document.createElement('div');
    renderBalances([], container);

    const emptyState = container.querySelector('.empty-state')!;
    expect(emptyState.textContent).toContain('rewards stash');
  });

  it('points text includes target emoji', () => {
    const container = document.createElement('div');
    renderOpportunities([SAMPLE_OPPORTUNITY], container);

    const points = container.querySelector('.points')!;
    expect(points.textContent).toContain('🎯');
    expect(points.textContent).toContain('Earn ~110 points!');
  });

  it('renders estimated value when provided', () => {
    const container = document.createElement('div');
    renderOpportunities(
      [{ ...SAMPLE_OPPORTUNITY, estimatedValueCents: 200 }],
      container
    );

    expect(container.textContent).toContain('Estimated value: $2.00');
  });
});

// ─────────────────────────────────────────────
// 3. Content Script Party Banner
// ─────────────────────────────────────────────
describe('Content script party banner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    document.getElementById('points-plugin-party-styles')?.remove();
  });

  it('injects party keyframes style element into head', () => {
    showOpportunities([SAMPLE_OPPORTUNITY]);

    const styleEl = document.getElementById('points-plugin-party-styles');
    expect(styleEl).toBeTruthy();
    expect(styleEl!.textContent).toContain('pp-party-gradient');
    expect(styleEl!.textContent).toContain('pp-banner-slide-in');
    expect(styleEl!.textContent).toContain('pp-sparkle-pulse');
  });

  it('injects keyframes only once even with multiple calls', () => {
    showOpportunities([SAMPLE_OPPORTUNITY]);
    showOpportunities([SAMPLE_OPPORTUNITY]);

    const styleEls = document.querySelectorAll('#points-plugin-party-styles');
    expect(styleEls).toHaveLength(1);
  });

  it('banner text uses party emoji', () => {
    const banner = createOpportunityBanner(SAMPLE_OPPORTUNITY);

    expect(banner.textContent).toContain('🎉');
    expect(banner.textContent).toContain('🥳');
    expect(banner.textContent).toContain('AA AAdvantage eShopping');
    expect(banner.textContent).toContain('110');
  });

  it('banner has rainbow gradient styling', () => {
    const banner = createOpportunityBanner(SAMPLE_OPPORTUNITY);

    // jsdom doesn't parse linear-gradient in background, but preserves animation and other styles
    expect(banner.style.cssText).toContain('pp-party-gradient');
    expect(banner.style.cssText).toContain('background-size: 400% 400%');
    expect(banner.style.cssText).toContain('255, 107, 107');
  });

  it('banner has slide-in animation', () => {
    const banner = createOpportunityBanner(SAMPLE_OPPORTUNITY);
    expect(banner.style.cssText).toContain('pp-banner-slide-in');
  });

  it('banner has party-colored box shadow', () => {
    const banner = createOpportunityBanner(SAMPLE_OPPORTUNITY);
    expect(banner.style.cssText).toContain('box-shadow');
    expect(banner.style.cssText).toContain('255, 107, 107');
  });

  it('does not show banner when no opportunities', () => {
    showOpportunities([]);
    expect(document.getElementById('points-plugin-banner')).toBeNull();
  });

  it('replaces existing banner and preserves single keyframes injection', () => {
    const opp1 = { ...SAMPLE_OPPORTUNITY, retailerName: 'Program A' };
    const opp2 = { ...SAMPLE_OPPORTUNITY, retailerName: 'Program B' };

    showOpportunities([opp1]);
    expect(document.getElementById('points-plugin-banner')!.textContent).toContain('Program A');

    showOpportunities([opp2]);
    expect(document.querySelectorAll('#points-plugin-banner')).toHaveLength(1);
    expect(document.getElementById('points-plugin-banner')!.textContent).toContain('Program B');
    expect(document.querySelectorAll('#points-plugin-party-styles')).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
// 4. Full User Flow E2E
// ─────────────────────────────────────────────
describe('Full user flow E2E', () => {
  it('complete popup flow: load → opportunities → balances → confetti', async () => {
    setupPopupDOM();
    mockOpportunitiesAndBalances(
      [
        SAMPLE_OPPORTUNITY,
        {
          url: 'https://www.nike.com/',
          retailerName: 'United MileagePlus Shopping',
          estimatedPoints: 100,
          estimatedValueCents: 120,
          programId: 'united-shopping',
        },
      ],
      [
        { programId: 'aa-eshopping', balance: 5000, lastUpdated: Date.now() },
      ]
    );

    await initPopup();

    // Verify loading is hidden
    expect(document.getElementById('loading')!.style.display).toBe('none');

    // Verify opportunities rendered
    const oppCards = document.querySelectorAll('.opportunity-card');
    expect(oppCards).toHaveLength(2);
    expect(document.body.textContent).toContain('AA AAdvantage eShopping');
    expect(document.body.textContent).toContain('United MileagePlus Shopping');

    // Verify party text in points
    expect(document.body.textContent).toContain('🎯 Earn ~110 points!');
    expect(document.body.textContent).toContain('🎯 Earn ~100 points!');

    // Verify activate buttons have party text
    const activateBtns = document.querySelectorAll('.activate-btn');
    expect(activateBtns).toHaveLength(2);
    activateBtns.forEach((btn) => {
      expect(btn.textContent).toBe('Activate 🎉');
    });

    // Verify balances rendered
    const balanceCards = document.querySelectorAll('.balance-card');
    expect(balanceCards).toHaveLength(1);
    expect(document.body.textContent).toContain('5,000');

    // Verify confetti spawned (opportunities > 0)
    const confetti = document.getElementById('confetti-container')!;
    expect(confetti.querySelectorAll('.confetti-piece')).toHaveLength(30);
  });

  it('popup shows party empty states when no data', async () => {
    setupPopupDOM();
    mockOpportunitiesAndBalances([], []);

    await initPopup();

    const emptyStates = document.querySelectorAll('.empty-state');
    expect(emptyStates).toHaveLength(2);

    const texts = Array.from(emptyStates).map((el) => el.textContent);
    expect(texts.some((t) => t!.includes('party deals'))).toBe(true);
    expect(texts.some((t) => t!.includes('rewards stash'))).toBe(true);
  });

  it('options page save shows party confirmation', async () => {
    document.body.innerHTML = `
      <input type="checkbox" id="enable-notifications" />
      <input type="number" id="min-points" value="100" />
      <div id="programs-list"></div>
      <form id="settings-form">
        <button type="submit">Save Settings</button>
      </form>
      <div id="status" style="display:none">Settings saved! Party on! 🎉🥳</div>
      <button id="add-program">Add Program</button>
    `;

    await initOptions();

    const form = document.getElementById('settings-form')!;
    form.dispatchEvent(new Event('submit'));

    // Wait for async save
    await Promise.resolve();
    await Promise.resolve();

    const status = document.getElementById('status')!;
    expect(status.style.display).toBe('block');
    expect(status.textContent).toContain('Party on!');
  });

  it('balance cards render with proper structure', async () => {
    setupPopupDOM();
    mockOpportunitiesAndBalances(
      [],
      [
        { programId: 'rakuten', balance: 250, lastUpdated: Date.now() },
        { programId: 'united-shopping', balance: 10000, lastUpdated: Date.now() },
      ]
    );

    await initPopup();

    const balanceCards = document.querySelectorAll('.balance-card');
    expect(balanceCards).toHaveLength(2);

    const values = document.querySelectorAll('.balance-value');
    expect(values).toHaveLength(2);
    expect(values[0].textContent).toBe('250');
    expect(values[1].textContent).toBe('10,000');
  });
});

// ─────────────────────────────────────────────
// 5. Error Resilience
// ─────────────────────────────────────────────
describe('Error resilience', () => {
  it('popup shows error when sendMessage fails', async () => {
    setupPopupDOM();
    chrome.tabs.query = jest.fn(async () => [
      { url: 'https://www.nike.com/' } as chrome.tabs.Tab,
    ]);
    chrome.runtime.sendMessage = jest.fn(async () => {
      throw new Error('Extension context invalidated');
    });

    await initPopup();

    const errorEl = document.getElementById('error')!;
    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toContain('Failed to load data');
  });

  it('popup hides loading even on error', async () => {
    setupPopupDOM();
    chrome.tabs.query = jest.fn(async () => [
      { url: 'https://www.nike.com/' } as chrome.tabs.Tab,
    ]);
    chrome.runtime.sendMessage = jest.fn(async () => {
      throw new Error('Network error');
    });

    await initPopup();

    expect(document.getElementById('loading')!.style.display).toBe('none');
  });

  it('showError displays message correctly', () => {
    const errorEl = document.createElement('div');
    errorEl.style.display = 'none';

    showError('Something broke', errorEl);

    expect(errorEl.style.display).toBe('block');
    expect(errorEl.textContent).toBe('Something broke');
  });

  it('content banner close button removes banner from DOM', () => {
    document.body.innerHTML = '';
    const banner = createOpportunityBanner(SAMPLE_OPPORTUNITY);
    document.body.appendChild(banner);

    expect(document.getElementById('points-plugin-banner')).toBeTruthy();

    const closeBtn = banner.querySelector('button')!;
    closeBtn.click();

    expect(document.getElementById('points-plugin-banner')).toBeNull();
  });
});
