import {
  ActivationUrlResultMessage,
  BalancesResultMessage,
  BuildActivationUrlMessage,
  ExtensionMessage,
  GetBalancesMessage,
  GetOpportunitiesMessage,
  KNOWN_PROGRAMS,
  MessageType,
  OpportunitiesResultMessage,
  PointsBalance,
  ShoppingOpportunity,
} from '../types/index';

const CONFETTI_COLORS = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#1dd1a1'];

/** Spawns a confetti burst in the popup */
function spawnConfetti(): void {
  const container = document.getElementById('confetti-container');
  if (!container) return;

  const count = 30;
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    const color = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    const left = Math.random() * 100;
    const delay = Math.random() * 0.5;
    const size = 6 + Math.random() * 6;
    const isCircle = Math.random() > 0.5;
    piece.style.cssText = `
      position: absolute;
      top: -10px;
      left: ${left}%;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      animation: confetti-fall ${1.5 + Math.random()}s ease-in ${delay}s forwards;
    `;
    container.appendChild(piece);
  }

  setTimeout(() => {
    container.innerHTML = '';
  }, 2500);
}

/** Sends a message to the background script */
export function sendMessage(message: ExtensionMessage): Promise<ExtensionMessage> {
  return chrome.runtime.sendMessage(message);
}

/** Gets the active tab's URL */
export async function getActiveTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? null;
}

function getProgram(programId: string): (typeof KNOWN_PROGRAMS)[number] | undefined {
  return KNOWN_PROGRAMS.find((program) => program.id === programId);
}

async function activateProgram(opportunity: ShoppingOpportunity): Promise<void> {
  const result = (await sendMessage({
    type: MessageType.BUILD_ACTIVATION_URL,
    programId: opportunity.programId,
    merchantUrl: opportunity.url,
  } as BuildActivationUrlMessage)) as ActivationUrlResultMessage;

  if (result.error) {
    console.error(result.error);
    return;
  }

  if (result.attributionRisk === 'possible_affiliate_tag') {
    const proceed = window.confirm(
      'Existing affiliate parameters were detected in the URL. Continue with explicit activation?'
    );
    if (!proceed) {
      return;
    }
  }

  await chrome.tabs.create({ url: result.activationUrl });
  spawnConfetti();
}

function addProgramActions(card: HTMLElement, opportunity: ShoppingOpportunity): void {
  const actions = document.createElement('div');
  actions.className = 'card-actions';

  const activateButton = document.createElement('button');
  activateButton.className = 'activate-btn';
  activateButton.textContent = 'Activate 🎉';
  activateButton.addEventListener('click', () => {
    void activateProgram(opportunity);
  });

  const program = getProgram(opportunity.programId);
  if (program?.signupUrl) {
    const signupLink = document.createElement('a');
    signupLink.href = program.signupUrl;
    signupLink.textContent = 'Sign up';
    signupLink.target = '_blank';
    signupLink.rel = 'noopener noreferrer';
    actions.appendChild(signupLink);
  }

  if (program?.loginUrl) {
    const loginLink = document.createElement('a');
    loginLink.href = program.loginUrl;
    loginLink.textContent = 'Login';
    loginLink.target = '_blank';
    loginLink.rel = 'noopener noreferrer';
    actions.appendChild(loginLink);
  }

  if (!program?.signupUrl && !program?.loginUrl) {
    activateButton.disabled = true;
    activateButton.title = 'Activation is unavailable for this program right now.';
  }

  actions.appendChild(activateButton);
  card.appendChild(actions);
}

/** Renders opportunity cards to the DOM */
export function renderOpportunities(
  opportunities: ShoppingOpportunity[],
  container: HTMLElement
): void {
  if (opportunities.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No party deals on this page... yet! 🪩';
    container.appendChild(empty);
    return;
  }

  opportunities.forEach((opp) => {
    const card = document.createElement('div');
    card.className = 'opportunity-card';

    const retailer = document.createElement('div');
    retailer.className = 'retailer';
    retailer.textContent = opp.retailerName;

    const points = document.createElement('div');
    points.className = 'points';
    points.textContent = `🎯 Earn ~${opp.estimatedPoints} points!`;

    card.appendChild(retailer);
    card.appendChild(points);

    if (opp.estimatedValueCents != null) {
      const value = document.createElement('div');
      value.className = 'points';
      value.textContent = `Estimated value: $${(opp.estimatedValueCents / 100).toFixed(2)}`;
      card.appendChild(value);
    }

    addProgramActions(card, opp);
    container.appendChild(card);
  });
}

/** Gets the program name for a balance */
export function getProgramName(balance: PointsBalance): string {
  const program = KNOWN_PROGRAMS.find((p) => p.id === balance.programId);
  return program?.name ?? balance.programId;
}

/** Renders balance cards to the DOM */
export function renderBalances(
  balances: PointsBalance[],
  container: HTMLElement
): void {
  if (balances.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No rewards stash yet -- go earn some! 🎊';
    container.appendChild(empty);
    return;
  }

  balances.forEach((balance) => {
    const card = document.createElement('div');
    card.className = 'balance-card';

    const name = document.createElement('div');
    name.className = 'program-name';
    name.textContent = getProgramName(balance);

    const value = document.createElement('div');
    value.className = 'balance-value';
    value.textContent = balance.balance.toLocaleString();

    card.appendChild(name);
    card.appendChild(value);
    container.appendChild(card);
  });
}

/** Shows an error message */
export function showError(message: string, errorEl: HTMLElement): void {
  errorEl.textContent = message;
  errorEl.style.display = 'block';
}

/** Hides the loading indicator and shows content sections */
export function hideLoading(
  loadingEl: HTMLElement,
  opportunitiesSection: HTMLElement,
  balancesSection: HTMLElement
): void {
  loadingEl.style.display = 'none';
  opportunitiesSection.hidden = false;
  balancesSection.hidden = false;
}

/** Main popup initialization */
export async function initPopup(): Promise<void> {
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const opportunitiesSection = document.getElementById('opportunities-section');
  const opportunitiesList = document.getElementById('opportunities-list');
  const balancesSection = document.getElementById('balances-section');
  const balancesList = document.getElementById('balances-list');
  const optionsLink = document.getElementById('options-link');

  if (
    !loadingEl ||
    !errorEl ||
    !opportunitiesSection ||
    !opportunitiesList ||
    !balancesSection ||
    !balancesList ||
    !optionsLink
  ) {
    return;
  }

  optionsLink.addEventListener('click', (e) => {
    e.preventDefault();
    void chrome.runtime.openOptionsPage();
  });

  try {
    const url = await getActiveTabUrl();

    const [opportunitiesResponse, balancesResponse] = await Promise.all([
      url
        ? (sendMessage({
            type: MessageType.GET_OPPORTUNITIES,
            url,
          } as GetOpportunitiesMessage) as Promise<OpportunitiesResultMessage>)
        : Promise.resolve(null),
      sendMessage({
        type: MessageType.GET_BALANCES,
      } as GetBalancesMessage) as Promise<BalancesResultMessage>,
    ]);

    hideLoading(loadingEl, opportunitiesSection, balancesSection);

    if (opportunitiesResponse) {
      renderOpportunities(opportunitiesResponse.opportunities, opportunitiesList);
      if (opportunitiesResponse.opportunities.length > 0) {
        spawnConfetti();
      }
    } else {
      renderOpportunities([], opportunitiesList);
    }

    renderBalances(balancesResponse.balances, balancesList);
  } catch (err) {
    showError('Failed to load data. Please try again.', errorEl);
    loadingEl.style.display = 'none';
    console.error(err);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    void initPopup();
  });
}
