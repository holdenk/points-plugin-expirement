import {
  extractPagePrice,
  createOpportunityBanner,
  showOpportunities,
} from '../src/content/content';

describe('extractPagePrice', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('extracts price from data-price attribute', () => {
    document.body.innerHTML = '<span data-price="29.99">$29.99</span>';
    expect(extractPagePrice()).toBe(29.99);
  });

  it('extracts price from .price element', () => {
    document.body.innerHTML = '<div class="price">$49.95</div>';
    expect(extractPagePrice()).toBe(49.95);
  });

  it('extracts price with commas', () => {
    document.body.innerHTML = '<div class="price">$1,299.00</div>';
    expect(extractPagePrice()).toBe(1299.0);
  });

  it('returns null when no price element found', () => {
    document.body.innerHTML = '<p>No price here</p>';
    expect(extractPagePrice()).toBeNull();
  });

  it('returns null when price text is not parseable', () => {
    document.body.innerHTML = '<div class="price">Free</div>';
    expect(extractPagePrice()).toBeNull();
  });
});

describe('createOpportunityBanner', () => {
  it('creates a banner element with correct content', () => {
    const opportunity = {
      url: 'https://amazon.com',
      retailerName: 'Amazon Rewards',
      estimatedPoints: 150,
      programId: 'amazon-rewards',
    };
    const banner = createOpportunityBanner(opportunity);
    expect(banner.id).toBe('points-plugin-banner');
    expect(banner.textContent).toContain('Amazon Rewards');
    expect(banner.textContent).toContain('150');
  });

  it('has a close button that removes the banner', () => {
    document.body.innerHTML = '';
    const opportunity = {
      url: 'https://amazon.com',
      retailerName: 'Amazon Rewards',
      estimatedPoints: 150,
      programId: 'amazon-rewards',
    };
    const banner = createOpportunityBanner(opportunity);
    document.body.appendChild(banner);

    const closeBtn = banner.querySelector('button');
    expect(closeBtn).toBeTruthy();
    closeBtn?.click();
    expect(document.getElementById('points-plugin-banner')).toBeNull();
  });

  it('sets accessibility attributes', () => {
    const opportunity = {
      url: 'https://amazon.com',
      retailerName: 'Amazon Rewards',
      estimatedPoints: 150,
      programId: 'amazon-rewards',
    };
    const banner = createOpportunityBanner(opportunity);
    expect(banner.getAttribute('role')).toBe('banner');
    expect(banner.getAttribute('aria-label')).toBe('Points opportunity');
  });
});

describe('showOpportunities', () => {
  beforeEach(() => {
    document.body.innerHTML = '<body></body>';
  });

  it('does nothing when no opportunities', () => {
    showOpportunities([]);
    expect(document.getElementById('points-plugin-banner')).toBeNull();
  });

  it('shows banner for first opportunity', () => {
    const opportunities = [
      {
        url: 'https://amazon.com',
        retailerName: 'Amazon Rewards',
        estimatedPoints: 150,
        programId: 'amazon-rewards',
      },
    ];
    showOpportunities(opportunities);
    expect(document.getElementById('points-plugin-banner')).toBeTruthy();
  });

  it('replaces existing banner with new one', () => {
    const opp1 = [
      {
        url: 'https://amazon.com',
        retailerName: 'Amazon Rewards',
        estimatedPoints: 150,
        programId: 'amazon-rewards',
      },
    ];
    showOpportunities(opp1);
    const opp2 = [
      {
        url: 'https://target.com',
        retailerName: 'Target Circle',
        estimatedPoints: 50,
        programId: 'target-circle',
      },
    ];
    showOpportunities(opp2);
    const banners = document.querySelectorAll('#points-plugin-banner');
    expect(banners).toHaveLength(1);
    expect(banners[0].textContent).toContain('Target Circle');
  });
});
