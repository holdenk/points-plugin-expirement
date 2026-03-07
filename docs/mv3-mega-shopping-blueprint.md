# OSS Chrome MV3 Mega Shopping Extension: Technical Blueprint

## Product goals
- Aggregate airline shopping portals and cashback programs in one extension.
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

## Adapter contract
The codebase now exposes a shared adapter interface in `src/types/index.ts`:
- Program metadata and type.
- `buildActivationUrl()` after explicit click.
- Optional non-blocking `refreshMerchantDomains()` and `refreshOffer()` lookups.
- Optional attribution-risk detection.

## Implementation notes from observing existing shopping extensions
- Most portal extensions appear to preload a merchant/domain index and then query offer/rate APIs per active tab. This implementation caches domain/rate results with a 24h TTL and refreshes opportunistically.
- UI notifications are generally suppressed once affiliate/tracking parameters are already present in the current URL.
- A degraded backend for one program should not block the rest of the UI; this project follows the same pattern with `Promise.allSettled`.

## Implemented UX behaviors
- First install opens options page to complete onboarding.
- Options page includes:
  - program enable/disable checkboxes,
  - “Add Program” quick-enable action,
  - per-program point valuation input (cents).
- Opportunity objects now include `estimatedValueCents` for value-aware ranking.

## Immediate next implementation milestones
1. Replace placeholder backend endpoints with per-program real endpoints and auth flows.
2. Add program-level health metrics and stale-cache indicators in popup.
3. Add Playwright E2E for onboarding + activation flow.
4. Add merchant-domain cache persistence and scheduled refresh policy.
