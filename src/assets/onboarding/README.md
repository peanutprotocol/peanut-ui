# Setup animations

- Security and notifications: existing variants from [mono #255](https://github.com/peanutprotocol/mono/pull/255), `projects/onboarding-animations/`.
- Card imports the existing `card-flip` illustration from [UI #3562](https://github.com/peanutprotocol/peanut-ui/pull/3562). Banking imports `globe-world-route` unchanged from [UI #3579](https://github.com/peanutprotocol/peanut-ui/pull/3579), commit `ea98dbd816f459b75aa552482bf67dfadeeae5fe`: LATAM-to-Europe bank transfers. Its SHA-256 is `03c30a4e51a395c7ecf681090cfce4829cff86918129dd8cbd49f4c015686875`.
- Email, fees and exchange rates import the existing `envelope-verify`, zero-total `receipt` and `coin-swap` assets from `src/assets/illustrations/lottie/`, published in [UI #3562](https://github.com/peanutprotocol/peanut-ui/pull/3562).
- The available-features checklist (screen 6) uses the existing `phone-to-phone` asset; the funding checklist (screen 9) uses `wallet-topup`. Both import unchanged from `src/assets/illustrations/lottie/`, with reduced-motion still frames at 36 and 32 respectively. All mobile setup heroes occupy 40% of the viewport; longer content scrolls. Both checklists use the same compact 48px data-row height, including when a label wraps onto two lines.
- Residence retains the document arrangement from UI #3392 commit `3e38ce80c`, with more noticeable, staggered floating and gentle tilting of the passport, ID and checkmark. The original four-second loop and reduced-motion arrangement remain. Its passport carries the requested Peanut coat of arms instead of the globe. Rebuild the vector emblem with `python3 scripts/build-residence-crest.py`; the generator preserves these movement keyframes.
- `username-at.json` is the requested missing background asset. It reuses #255's cubic vector @ artwork, with four independent signs outside the central mascot area. Transparent 1050 × 1000 canvas, 30fps, a seamless 20-second loop, no fonts or external images. Regenerate from the UI root with `python3 scripts/build-username-background.py`.

The shared onboarding player pauses when the page is hidden and holds a still frame for reduced motion (the printed receipt at frame 32, the open envelope at frame 40, both exchange coins at frame 0, and frame 0 for the other assets).

Security uses #255’s existing mascot-on-safe variant. Notifications uses `13-notifications-object-alt-2.json` (a phone receiving an update), copied unchanged from the same PR.

The local-payments feature reuses #255’s `local.json` = `05-local-object` (QR scanning). “Pay people, not account numbers” imports the unchanged `plane-delivery.json` illustration from [UI #3579](https://github.com/peanutprotocol/peanut-ui/pull/3579), commit `ea98dbd816f459b75aa552482bf67dfadeeae5fe`. It shows a banknote plane delivering money into a phone, using the existing compact feature scale and a reduced-motion still frame at 30. No new animation artwork was created.

Username @ signs play at 2× speed (a ten-second loop), and the banking globe now plays at 1× instead of 0.5×. Card flip holds its final frame for 500ms after each cycle before restarting. Visibility changes and reduced motion cancel pending restarts.
