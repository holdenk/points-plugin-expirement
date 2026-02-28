# OSS Chrome MV3 Mega Shopping Extension: Technical Blueprint

## Product goals
- Aggregate airline shopping portals, cashback programs, and receipt-app flows in one extension.
- Keep activation compliant: explicit user click only, no silent cookie overwrite/hijack.
- Support first-launch onboarding and program management later via settings.
- Let users define point values (cents/point) to rank opportunities by estimated dollar value.

## Compliance contract (v1)
1. User-click-only activation URLs.
2. No passive background browsing collection.
3. No cookie setting/modification outside user action.
4. Monetization and affiliate behavior disclosed in options UI and store listing.

## MV3 architecture notes
- Service worker is treated as ephemeral and stateless.
- Use `chrome.storage` as durable state for settings and balances.
- No remote code execution; adapters and logic shipped in package.

## Program coverage in current scaffold
- Airline: AA AAdvantage eShopping, United MileagePlus Shopping, Alaska Atmos Rewards, Delta SkyMiles Shopping, JetBlue TrueBlue Shopping, Southwest Rapid Rewards Shopping.
- Cashback/coupon: Rakuten, Capital One Shopping, Mr. Rebates.
- Receipt app: Fetch.

## Adapter contract
The codebase now exposes a shared adapter interface in `src/types/index.ts`:
- Program metadata and type.
- `buildActivationUrl()` after explicit click.
- Optional offer refresh, attribution-risk detection, and alternate earning methods.

## Implemented UX behaviors
- First install opens options page to complete onboarding.
- Options page includes:
  - program enable/disable checkboxes,
  - “Add Program” quick-enable action,
  - per-program point valuation input (cents).
- Opportunity objects now include `estimatedValueCents` for value-aware ranking.

## Immediate next implementation milestones
1. Add catalog schema and CI validation for merchants/offers.
2. Implement concrete adapters per program (catalog-only first).
3. Add explicit activation buttons in popup with outbound URL confirmation.
4. Add Playwright E2E for onboarding + activation flow.
5. Add Fetch alternate earning-method surfacing in popup/options.
