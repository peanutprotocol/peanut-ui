# Card art — follow-ups (maybe to do)

The in-app card is composited in code (`CardFace.tsx` / `PixelatedCardFace.tsx`),
not a single image, so it silently drifted from the finalised card art we sent to
Rain (the one Apple Wallet shows). Vlad flagged it on 2026-06-30: white Visa with
no Platinum tier, no PEANUT wordmark, different hand placement.

## Shipped on this branch (`feat/card-art-visa-platinum`)

- Dark **Visa Platinum** lockup replaces the inverted white Visa brand mark.
- **Swing-in** arm animation on mount — pivots from the bottom-right "shoulder",
  settles at -15°.

## Maybe to do (deferred, not decided)

- [ ] **PEANUT wordmark** next to the mascot on the card face. The finalised art
      has it; prototyped in the preview, left out here.
- [ ] **White pill** behind the revealed number + name/expiry/CVV so they stay
      legible over the hand. Prototyped in the preview.
- [ ] **Cardholder name always visible** (masked *and* revealed), like a physical
      card. Currently on-reveal only, sourced from the Rain reveal payload
      (`revealed.cardholderName`); an always-on version would need
      `userData.fullName` in the masked state too.
- [ ] **`PixelatedCardFace.tsx`** still renders the old white Visa (share asset /
      eligibility check / `/shhhhh` hero). Bring it in line with Visa Platinum.
- [ ] **Confirm the hand asset.** Repo uses `peanut-card-hand.svg`; if the
      finalised Rain art is a different hand pose/size, swap the SVG.
- [ ] **In-app visual QA** of the swing + Visa Platinum on the real "Your card"
      and Physical card screens (only verified via unit tests + standalone
      preview so far).
- [ ] **Tune hand resting position/scale** against the finalised art.

## Design iteration tool

A live, editable preview lives at `card-preview/index.html` (local scratch, served
on `localhost:8765`) with sliders for hand position/scale/rotation, swing
easing/wind-up, the white pill, and number position. Use it to dial values before
wiring them into the component.
