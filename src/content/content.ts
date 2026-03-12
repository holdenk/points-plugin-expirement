import {
  ContentLoadedMessage,
  ExtensionMessage,
  GetOpportunitiesMessage,
  MessageType,
  OpportunitiesResultMessage,
  ShoppingOpportunity,
} from '../types/index';

/** Sends a message to the background script */
export function sendMessage(message: ExtensionMessage): Promise<ExtensionMessage> {
  return chrome.runtime.sendMessage(message);
}

/** Extracts the current page price if available */
export function extractPagePrice(): number | null {
  // Look for common price element patterns
  const priceSelectors = [
    '[data-price]',
    '.price',
    '#price',
    '[itemprop="price"]',
    '.a-price-whole', // Amazon
    '[data-testid="current-price"]', // Target
  ];

  for (const selector of priceSelectors) {
    const element = document.querySelector(selector);
    if (element) {
      const priceText =
        element.getAttribute('data-price') ?? element.textContent ?? '';
      const match = priceText.match(/[\d,]+\.?\d*/);
      if (match) {
        const price = parseFloat(match[0].replace(/,/g, ''));
        if (!isNaN(price) && price > 0) {
          return price;
        }
      }
    }
  }
  return null;
}

/** Creates a notification banner element */
export function createOpportunityBanner(
  opportunity: ShoppingOpportunity
): HTMLElement {
  const banner = document.createElement('div');
  banner.id = 'points-plugin-banner';
  banner.setAttribute('role', 'banner');
  banner.setAttribute('aria-label', 'Points opportunity');
  banner.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'right: 0',
    'z-index: 2147483647',
    'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'color: white',
    'padding: 12px 16px',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    'font-size: 14px',
    'display: flex',
    'align-items: center',
    'justify-content: space-between',
    'box-shadow: 0 2px 8px rgba(0,0,0,0.3)',
  ].join('; ');

  const text = document.createElement('span');
  text.textContent = `🎯 ${opportunity.programName}: Earn ~${opportunity.estimatedPoints} points on this purchase!`;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'Close points notification');
  closeBtn.style.cssText = [
    'background: none',
    'border: none',
    'color: white',
    'cursor: pointer',
    'font-size: 16px',
    'padding: 0 4px',
    'margin-left: 12px',
  ].join('; ');
  closeBtn.addEventListener('click', () => banner.remove());

  banner.appendChild(text);
  banner.appendChild(closeBtn);
  return banner;
}

/** Shows opportunity banners for detected shopping opportunities */
export function showOpportunities(opportunities: ShoppingOpportunity[]): void {
  // Remove any existing banner
  document.getElementById('points-plugin-banner')?.remove();

  if (opportunities.length === 0) return;

  // Show the first opportunity (most relevant)
  const banner = createOpportunityBanner(opportunities[0]);
  document.body.prepend(banner);
}

/** Main initialization function for the content script */
export async function init(): Promise<void> {
  // Notify background that content script has loaded
  const loadedMessage: ContentLoadedMessage = {
    type: MessageType.CONTENT_LOADED,
    url: window.location.href,
  };

  try {
    await sendMessage(loadedMessage);
  } catch {
    // Extension context may not be ready yet, ignore
  }

  // Request opportunities for the current page
  const pagePrice = extractPagePrice();
  const requestMessage: GetOpportunitiesMessage = {
    type: MessageType.GET_OPPORTUNITIES,
    url: window.location.href,
    ...(pagePrice != null ? { pagePrice } : {}),
  };

  try {
    const response = (await sendMessage(requestMessage)) as OpportunitiesResultMessage;
    if (response.type === MessageType.OPPORTUNITIES_RESULT) {
      showOpportunities(response.opportunities);
    }
  } catch {
    // Extension may not be available, ignore silently
  }
}

// Only initialize when running in browser context (not tests)
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  void init();
}
