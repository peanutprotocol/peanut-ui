# Setup animations

- Card, bank, security and notifications: existing variants from [mono #255](https://github.com/peanutprotocol/mono/pull/255), `projects/onboarding-animations/`.
- Email, fees and exchange rates import the existing `envelope-verify`, zero-total `receipt` and `coin-swap` assets from `src/assets/illustrations/lottie/`, published in [UI #3562](https://github.com/peanutprotocol/peanut-ui/pull/3562).
- The available-features checklist (screen 6) uses the existing `phone-to-phone` asset; the funding checklist (screen 9) uses `wallet-topup`. Both import unchanged from `src/assets/illustrations/lottie/`, with compact heroes and reduced-motion still frames at 36 and 32 respectively.
- Residence retains the document arrangement from UI #3392 commit `3e38ce80c`, with more noticeable, staggered floating and gentle tilting of the passport, ID and checkmark. The original four-second loop and reduced-motion arrangement remain. Its passport carries the requested Peanut coat of arms instead of the globe. Rebuild the vector emblem with `python3 scripts/build-residence-crest.py`; the generator preserves these movement keyframes.
- `username-at.json` is the requested missing background asset. It reuses #255's cubic vector @ artwork, with four independent signs outside the central mascot area. Transparent 1050 × 1000 canvas, 30fps, a seamless 20-second loop, no fonts or external images. Regenerate from the UI root with `python3 scripts/build-username-background.py`.

The shared onboarding player pauses when the page is hidden and holds a still frame for reduced motion (the printed receipt at frame 32, the open envelope at frame 40, both exchange coins at frame 0, and frame 0 for the other assets).

Bank uses #255’s bank-building object variant; security uses its existing mascot-on-safe variant. Notifications uses `13-notifications-object-alt-2.json` (a phone receiving an update), copied unchanged from the same PR.

Regional/fallback features also reuse #255 exports: `local.json` = `05-local-object` (QR scanning), `people.json` = `07-username-object-alt-3` (payment to a username). No new animation artwork was created.
