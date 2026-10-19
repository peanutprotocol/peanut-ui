# Banking illustrations (Lottie)

> **Deprecated: out of brand (Hugo, 2026-10-10). Experimental only; do not use in new screens.** The one file still in use is `mascot-juggle.json`, the `juggling` mascot pose on the points page.

Object animations for banking concepts, drawn to the setup mascot's rules
(`src/assets/mascot/lottie/`). All are mascot-free except `mascot-juggle.json`, which reuses the
`waving-hello` rig with new arms. `mascot-juggle.json` is the `juggling` mascot pose on the rewards page.

- 1050 × 1000 canvas, 30 fps, seamless loops, transparent background, no fonts or images
- outlines 10.5 / 9 / 7.5, round caps; mascot palette (#FCC814, #E882D0, white, #F2B786, #CC485E, #FFC1CF, #46ACFF)
- authored to be played like `PeanutMascot`: each frame held twice (`MASCOT_HOLD_FRAMES`) at `MASCOT_SPEED`
- before rendering one through `PeanutMascot`, measure its art box the same way `MASCOT_ART_BOXES` is generated

6 files kept on Konrad's 19 Oct 2026 review; the other 38 were deleted in the asset sweep.

| File | Topic | Animation | Suggested use | Frames |
| --- | --- | --- | --- | --- |
| `card-freeze.json` | Card | The card shivers, frosts over and a snowflake badge locks it; then it thaws. | Freeze / unfreeze card, card controls | 80 |
| `shield-check.json` | Security | A shield lands with a squash, a check draws itself, sparkles pop around it. | Account protected, security settings, “your money is safe” | 60 |
| `globe.json` | Exchange | A globe spins while dollar and euro coins orbit around it on a tilted ring. | Send worldwide, global account, multi-currency | 90 |
| `currency-flip.json` | Multi-currency | One coin keeps flipping over, showing a new currency on every turn: $, €, £, ¥. | Multi-currency account, hold several currencies, local currency | 80 |
| `globe-latam.json` | Money around the world | A globe turned to the Americas while five LATAM currency coins orbit it: $, R$, S/, Bs and Q. | Send across Latin America, local currencies, LATAM coverage | 120 |
| `globe-latam-route.json` | Money around the world | Pins pop up on Mexico, Brazil and Argentina and a coin hops between them, switching to each country’s currency as it lands. | Cross-border LATAM transfers, local payouts, country coverage | 110 |
| `mascot-juggle.json` | Rewards | The peanut mascot juggles three star coins in a three-ball cascade, rubber-hose arms scooping each catch while it bobs to the rhythm. | Rewards / Points screen hero, earn points, streaks | 66 |
