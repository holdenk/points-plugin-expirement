import { initPopup, renderOpportunities } from '../src/popup/popup';
import { MessageType } from '../src/types';

describe('UA MileagePlus flow (E2E-style)', () => {
  it('shows two miles opportunities when user is on a known partner website', async () => {
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
    `;

    chrome.tabs.query = jest.fn(async () => [{ url: 'https://www.nike.com/' } as chrome.tabs.Tab]);
    chrome.runtime.sendMessage = jest.fn(async (message: any) => {
      if (message.type === MessageType.GET_OPPORTUNITIES) {
        return {
          type: MessageType.OPPORTUNITIES_RESULT,
          opportunities: [
            {
              url: 'https://www.nike.com/',
              retailerName: 'AA AAdvantage eShopping',
              estimatedPoints: 110,
              estimatedValueCents: 154,
              programId: 'aa-eshopping',
            },
            {
              url: 'https://www.nike.com/',
              retailerName: 'United MileagePlus Shopping',
              estimatedPoints: 100,
              estimatedValueCents: 120,
              programId: 'united-shopping',
            },
          ],
        };
      }

      if (message.type === MessageType.GET_BALANCES) {
        return {
          type: MessageType.BALANCES_RESULT,
          balances: [],
        };
      }

      throw new Error(`Unexpected message type: ${message.type as string}`);
    });

    await initPopup();

    const opportunityCards = document.querySelectorAll('.opportunity-card');
    expect(opportunityCards).toHaveLength(2);
    expect(document.body.textContent).toContain('AA AAdvantage eShopping');
    expect(document.body.textContent).toContain('Earn ~110 points');
    expect(document.body.textContent).toContain('United MileagePlus Shopping');
    expect(document.body.textContent).toContain('Earn ~100 points');
    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: MessageType.GET_OPPORTUNITIES,
      url: 'https://www.nike.com/',
    });
  });

  it('activates United opportunity from popup click-through', async () => {
    const container = document.createElement('div');

    chrome.runtime.sendMessage = jest.fn(async (message: any) => {
      if (message.type === MessageType.BUILD_ACTIVATION_URL) {
        return {
          type: MessageType.ACTIVATION_URL_RESULT,
          programId: 'united-shopping',
          activationUrl: 'https://shopping.mileageplus.com/?target=https%3A%2F%2Fwww.nike.com%2F',
          attributionRisk: 'none',
        };
      }
      throw new Error(`Unexpected message type: ${message.type as string}`);
    });

    renderOpportunities(
      [
        {
          url: 'https://www.nike.com/',
          retailerName: 'United MileagePlus Shopping',
          estimatedPoints: 100,
          estimatedValueCents: 120,
          programId: 'united-shopping',
        },
      ],
      container
    );

    const activateButton = container.querySelector('.activate-btn') as HTMLButtonElement;
    expect(activateButton).toBeTruthy();
    expect(activateButton.textContent).toBe('Activate 🎉');
    expect(activateButton.disabled).toBe(false);

    activateButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
      type: MessageType.BUILD_ACTIVATION_URL,
      programId: 'united-shopping',
      merchantUrl: 'https://www.nike.com/',
    });
    expect(chrome.tabs.create).toHaveBeenCalledWith({
      url: 'https://shopping.mileageplus.com/?target=https%3A%2F%2Fwww.nike.com%2F',
    });

    const createdTabPayload = (chrome.tabs.create as jest.Mock).mock.calls[0][0] as { url: string };
    const activationUrl = new URL(createdTabPayload.url);
    expect(activationUrl.hostname).toBe('shopping.mileageplus.com');
    expect(activationUrl.searchParams.get('target')).toBe('https://www.nike.com/');
  });
});
