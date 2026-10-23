# Controlled card-funding enrollment — review images

Current captures use the signed UI `3586e2cdfe4a102d04ccec1009bc1d52e036bfff`, private production build `hs94zipqbFOk302y5zeEx`, at 375 × 667. These are actual app screens with synthetic API fixture state. They are not provider, chain, ledger, payment or migration proof. All 4,635 staged build inputs matched the signed manifest after capture. External requests were blocked.

- `full-app-1-legacy-funding-prompt.png`: non-pilot account keeps the existing permission prompt.
- `full-app-2-eligible-enrollment.png`: selected account sees one unchecked funding authorization.
- `full-app-3-unknown-access-home.png`: unreadable access does not show either setup prompt.
- `full-app-4-legacy-collateral-card.png`: ordinary card screen for a non-pilot account. Tests also assert the managed move action is absent; this viewport does not show the whole page.
- `full-app-5-legacy-terms-ready.png`: legacy reissue terms, four rows checked, Continue above the bottom navigation. The button receives events at the real page end; no application or signing action was submitted.
- `earlier-funding-migration.png`: earlier actual-app fixture capture from UI `9c0f12134d7998c1e0dc11fcbd1d891ce56c548b`, retained for comparison. This is a historical view, not a pixel-diff baseline for every current state.

Validation: the 23 mobile card-flow fixture tests passed. Five additional captures passed their readiness assertions. A narrow legacy-terms scroll and hit-test check passed. Earlier custom component-bundle attempts failed before rendering on Node globals; they provide no pilot visual evidence and were replaced by these production-build captures.

Synthetic fixtures do not prove a real user's transition, real Rain payments, settlement/refunds or native-phone signing. No running sandbox was refreshed.
