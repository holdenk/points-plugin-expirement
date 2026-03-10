import {
  renderOpportunities,
  renderBalances,
  showError,
  hideLoading,
  getProgramName,
} from '../src/popup/popup';

describe('getProgramName', () => {
  it('returns program name for known programId', () => {
    const balance = { programId: 'aa-eshopping', balance: 500, lastUpdated: Date.now() };
    expect(getProgramName(balance)).toBe('AA AAdvantage eShopping');
  });
});

describe('renderOpportunities', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders empty state when no opportunities', () => {
    renderOpportunities([], container);
    expect(container.querySelector('.empty-state')).toBeTruthy();
  });

  it('renders activate action and links', () => {
    const opportunities = [
      {
        url: 'https://www.nike.com',
        programName: 'Rakuten',
        estimatedPoints: 150,
        estimatedValueCents: 150,
        programId: 'rakuten',
      },
    ];

    renderOpportunities(opportunities, container);
    expect(container.querySelectorAll('.opportunity-card')).toHaveLength(1);
    expect(container.querySelectorAll('.activate-btn')).toHaveLength(1);
    expect(container.querySelectorAll('.card-actions a').length).toBeGreaterThanOrEqual(1);
  });

  it('renders a signup link for United MileagePlus Shopping', () => {
    const opportunities = [
      {
        url: 'https://www.nike.com',
        programName: 'United MileagePlus Shopping',
        estimatedPoints: 120,
        estimatedValueCents: 144,
        programId: 'united-shopping',
      },
    ];

    renderOpportunities(opportunities, container);

    const signupLink = Array.from(container.querySelectorAll('.card-actions a')).find(
      (anchor) => anchor.textContent === 'Sign up'
    ) as HTMLAnchorElement | undefined;

    expect(signupLink).toBeTruthy();
    expect(signupLink?.href).toBe('https://shopping.mileageplus.com/');
    expect(signupLink?.target).toBe('_blank');
  });


  it('renders zero estimated value and secure links', () => {
    const opportunities = [
      {
        url: 'https://www.nike.com',
        programName: 'United MileagePlus Shopping',
        estimatedPoints: 0,
        estimatedValueCents: 0,
        programId: 'united-shopping',
      },
    ];

    renderOpportunities(opportunities, container);

    expect(container.textContent).toContain('Estimated value: $0.00');
    const links = Array.from(container.querySelectorAll('.card-actions a')) as HTMLAnchorElement[];
    links.forEach((link) => {
      expect(link.rel).toBe('noopener noreferrer');
    });
  });

  it('disables activate when program has no activation base URL', () => {
    const opportunities = [
      {
        url: 'https://www.nike.com',
        programName: 'Delta SkyMiles Shopping',
        estimatedPoints: 100,
        estimatedValueCents: 120,
        programId: 'delta-skymiles-shopping',
      },
    ];

    renderOpportunities(opportunities, container);

    const activateButton = container.querySelector('.activate-btn') as HTMLButtonElement;
    expect(activateButton.disabled).toBe(true);
    expect(activateButton.textContent).toBe('Coming Soon');
  });
});

describe('renderBalances', () => {
  it('renders empty state when no balances', () => {
    const container = document.createElement('div');
    renderBalances([], container);
    expect(container.querySelector('.empty-state')).toBeTruthy();
  });
});

describe('showError', () => {
  it('shows error message in element', () => {
    const errorEl = document.createElement('div');
    showError('Something went wrong', errorEl);
    expect(errorEl.style.display).toBe('block');
  });
});

describe('hideLoading', () => {
  it('hides loading and shows sections', () => {
    const loadingEl = document.createElement('div');
    const opSection = document.createElement('section');
    const balSection = document.createElement('section');
    opSection.hidden = true;
    balSection.hidden = true;

    hideLoading(loadingEl, opSection, balSection);

    expect(loadingEl.style.display).toBe('none');
    expect(opSection.hidden).toBe(false);
    expect(balSection.hidden).toBe(false);
  });
});
