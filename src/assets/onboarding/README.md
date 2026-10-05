# Setup animations

- Card, bank, security and notifications: existing mascot variants from [mono #255](https://github.com/peanutprotocol/mono/pull/255), `projects/onboarding-animations/`.
- Fees, email and residence import the existing `fee-scissors`, `envelope-verify` and `id-card` assets from `src/assets/illustrations/lottie/`, published in [UI #3562](https://github.com/peanutprotocol/peanut-ui/pull/3562).
- `username-at.json` is the requested missing background asset. It reuses #255's cubic vector @ artwork, with four independent signs outside the central mascot area. Transparent 1050 × 1000 canvas, 30fps, a seamless 20-second loop, no fonts or external images. Regenerate from the UI root with `python3 scripts/build-username-background.py`.

The shared onboarding player pauses when the page is hidden and holds frame 0 for reduced motion.
