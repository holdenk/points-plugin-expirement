import {
  renderOpportunities,
  renderBalances,
  showError,
  hideLoading,
  getProgramName,
} from '../src/popup/popup';
import { KNOWN_PROGRAMS } from '../src/types/index';

describe('getProgramName', () => {
  it('returns program name for known programId', () => {
    const balance = { programId: 'amazon-rewards', balance: 500, lastUpdated: Date.now() };
    expect(getProgramName(balance)).toBe('Amazon Rewards');
  });

  it('returns programId as fallback for unknown program', () => {
    const balance = { programId: 'unknown-id', balance: 100, lastUpdated: Date.now() };
    expect(getProgramName(balance)).toBe('unknown-id');
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
    expect(container.textContent).toContain('No points opportunities');
  });

  it('renders a card for each opportunity', () => {
    const opportunities = [
      {
        url: 'https://amazon.com',
        retailerName: 'Amazon Rewards',
        estimatedPoints: 150,
        programId: 'amazon-rewards',
      },
      {
        url: 'https://target.com',
        retailerName: 'Target Circle',
        estimatedPoints: 50,
        programId: 'target-circle',
      },
    ];
    renderOpportunities(opportunities, container);
    expect(container.querySelectorAll('.opportunity-card')).toHaveLength(2);
    expect(container.textContent).toContain('Amazon Rewards');
    expect(container.textContent).toContain('Target Circle');
  });

  it('displays estimated points for each opportunity', () => {
    const opportunities = [
      {
        url: 'https://amazon.com',
        retailerName: 'Amazon Rewards',
        estimatedPoints: 300,
        programId: 'amazon-rewards',
      },
    ];
    renderOpportunities(opportunities, container);
    expect(container.textContent).toContain('300');
  });
});

describe('renderBalances', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
  });

  it('renders empty state when no balances', () => {
    renderBalances([], container);
    expect(container.querySelector('.empty-state')).toBeTruthy();
    expect(container.textContent).toContain('No balances tracked');
  });

  it('renders a card for each balance', () => {
    const balances = [
      { programId: 'amazon-rewards', balance: 1500, lastUpdated: Date.now() },
      { programId: 'target-circle', balance: 200, lastUpdated: Date.now() },
    ];
    renderBalances(balances, container);
    expect(container.querySelectorAll('.balance-card')).toHaveLength(2);
    expect(container.textContent).toContain('Amazon Rewards');
    expect(container.textContent).toContain('Target Circle');
  });

  it('displays formatted balance values', () => {
    const balances = [
      { programId: 'amazon-rewards', balance: 1500, lastUpdated: Date.now() },
    ];
    renderBalances(balances, container);
    expect(container.textContent).toContain('1,500');
  });
});

describe('showError', () => {
  it('shows error message in element', () => {
    const errorEl = document.createElement('div');
    showError('Something went wrong', errorEl);
    expect(errorEl.textContent).toBe('Something went wrong');
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
