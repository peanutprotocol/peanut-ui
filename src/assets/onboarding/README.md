# Setup animations

- Card, security and notifications: existing mascot variants from [mono #255](https://github.com/peanutprotocol/mono/pull/255), `projects/onboarding-animations/`.
- Bank, email and fees import the existing `account-details`, `envelope-verify` and zero-total `receipt` assets from `src/assets/illustrations/lottie/`, published in [UI #3562](https://github.com/peanutprotocol/peanut-ui/pull/3562).
- Residence restores the previously used `documents.json` (passport, identity document and checked documents) from UI #3392 commit `3e38ce80c`.
- `username-at.json` is the requested missing background asset. It reuses #255's cubic vector @ artwork, with four independent signs outside the central mascot area. Transparent 1050 × 1000 canvas, 30fps, a seamless 20-second loop, no fonts or external images. Regenerate from the UI root with `python3 scripts/build-username-background.py`.

The shared onboarding player pauses when the page is hidden and holds a still frame for reduced motion (the printed receipt at frame 32, the completed bank statement and open envelope at frame 40, and frame 0 for the other assets).
