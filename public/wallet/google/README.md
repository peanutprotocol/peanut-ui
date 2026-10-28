Google-supplied Add to Google Wallet SVG artwork with only the pill removed. `GoogleWalletButton` draws the pill full width in CSS with Google's fill (`#1F1F1F`), 1px outline (`#747775`) and fully rounded ends, the way Google's Android codelab builds the button (a `match_parent` 48dp background shape with the artwork centered).

- Issuer branding requirements: https://developers.google.com/pay/issuers/apis/push-provisioning/android/branding-guidelines
- Wallet brand guidelines: https://developers.google.com/wallet/generic/resources/brand-guidelines
- Codelab button layout: https://codelabs.developers.google.com/save-to-wallet-android
- Source archive: https://developers.google.com/static/wallet/download-assets/add-to-wallet-svg.zip
- Retrieved: 2026-10-23 (two-line files first retrieved 2026-10-09). The issuer documentation's archive links returned 404; Google's shared Wallet archive supplies these official assets.

| File | Source in the archive |
| --- | --- |
| `one-line/en.svg` | `enUS_add_to_google_wallet_wallet-button.svg` |
| `one-line/es-419.svg` | `es419_add_to_google_wallet_wallet-button.svg` (also es-AR) |
| `one-line/pt-BR.svg` | `br_add_to_google_wallet_wallet-button.svg` |
| `two-line/en.svg` | `enUS_add_to_google_wallet_add-wallet-badge.svg` |
| `two-line/es-419.svg` | `es419_add_to_google_wallet_add-wallet-badge.svg` (also es-AR) |
| `two-line/pt-BR.svg` | `br_add_to_google_wallet_add-wallet-badge.svg` |

Each file is the archive file minus its two `<rect>` elements (pill fill and outline). Icon and text paths, viewBox and internal spacing are unchanged.

The one-line (primary) button is Google's choice for light backgrounds. It renders 48px high and needs its full drawn width at that height (Google's side padding included). Where the pill is narrower, the button falls back to the two-line (condensed) badge at 56px, as Google's guidelines direct. Keep at least 8dp clear space around the button. Only show it when it starts native card provisioning. Google UX/branding review and production launch approval remain required before rollout.

## Google Pay logo (`google-pay-logo.svg`)

The card intro (`AddCardEntryScreen`) shows it beside the Visa logo. Source: `Google Pay Mark/google-pay-mark_800.svg` in https://developers.google.com/static/pay/api/download-assets/Google-Pay-Acceptance.zip, retrieved 2026-10-28.

Changed from the source on Slava's call: the pill outline is removed, and the viewBox is cropped so the G fills 24 of every 32 units, with the rest left for the descender of the y. The glyph paths and colours are unchanged. Google's public guidelines say "Use only the Google Pay mark provided by Google" and not to alter the mark. Google's issuer branding review must clear this before rollout.
