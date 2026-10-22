# Scanned payment request: before and after

Synthetic component visuals at 375 × 667. The actual pay screen, token selector, amount input, recipient card and Send button render with each signed private build’s CSS. Context contains synthetic balances, recipients and supported assets. Logos are fixture dots. These are not payment, provider, ledger or migration tests.

Before: e9a3730df1dfab198ee4e893e633745288792ce1. A Base USDC request can change to Arbitrum USDT while Send remains enabled.

After: 28fc872162391c1f41c75526a8d1c580dab38eb7. Asset requests retain their network and token. Both controls are disabled. A mismatched pair cannot continue. Chain-only requests allow another token on the requested network; another network disables Send. Bare EVM addresses retain the existing default and selectors.

Nine captures and one selection video passed for each build. All 122 bundled source files matched their signed build manifests. No external request was attempted. Continue only records the selected pair in a stub; it never creates a charge. The Next browser-bundle harness excludes unreachable server compression builtins.

The transition videos show selector interactions only. Native iOS/Capacitor and real wallet behavior remain untested by these captures.
