## Apple Pay logo (`apple-pay-logo.svg`)

The card intro (`AddCardEntryScreen`) shows it beside the Visa logo on iOS, where Android shows `../google/google-pay-logo.svg`. Source: `Apple Pay Mark/SVG/Apple_Pay_Mark_RGB_041619.svg` in https://developer.apple.com/apple-pay/marketing/Apple-Pay-Mark.zip, retrieved 2026-10-28.

Changed from the source on Slava's call, to match the Google Pay logo: the outline rule and its white fill are removed, and the viewBox is cropped so the Apple logo fills 24 of every 32 units, with the rest left for the descender of the y. The glyph paths are unchanged. Apple's marketing guidelines say "Don't alter the artwork in any way" and offer the mark only with its outline rule, and App Review checks Apple Pay branding against those guidelines (App Review Guideline 4.9), so this can be raised in iOS review. Apple Pay issuer approval must clear it before rollout.
