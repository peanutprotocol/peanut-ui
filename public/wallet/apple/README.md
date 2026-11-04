## Apple Pay logo (`apple-pay-logo.svg`)

The card intro (`AddCardEntryScreen`) shows it beside the Visa logo on iOS, where Android shows `../google/google-pay-logo.svg`. Source: `Apple Pay Mark/SVG/Apple_Pay_Mark_RGB_041619.svg` in https://developer.apple.com/apple-pay/marketing/Apple-Pay-Mark.zip, retrieved 2026-10-28.

Changed from the source on Slava's call, to match the Google Pay logo: the outline rule and its white fill are removed, and the viewBox is cropped so the Apple logo fills 24 of every 32 units, with the rest left for the descender of the y. The glyph paths are unchanged. Apple's marketing guidelines say "Don't alter the artwork in any way" and offer the mark only with its outline rule, and App Review checks Apple Pay branding against those guidelines (App Review Guideline 4.9), so this can be raised in iOS review. Apple Pay issuer approval must clear it before rollout.

## Apple Pay mark for the Add to Apple Wallet row (`apple-pay-mark.svg`)

`AppleWalletRow` shows it in front of "Add to Apple Wallet" below Card management on iOS, where Android shows the Google Wallet button. Source: `Apple Pay Mark/SVG/Apple_Pay_Mark_RGB_041619.svg` in https://developer.apple.com/apple-pay/marketing/Apple-Pay-Mark.zip, retrieved 2026-11-04. The file is unchanged, outline rule included.

Why a row and not the Add to Apple Wallet badge: Apple's In-App Provisioning guide (https://applepaydemo.apple.com/in-app-provisioning) says "The issuer must NOT create their own buttons as the app may be rejected during App Store review" and allows only `PKAddPassButton` or "the Apple Pay acceptance mark and text within a row selector", where "the text must directly correspond to the PKAddPassButton and Apple Pay mark must not be changed". Our add asks for a passkey before Apple's sheet, and the guide says "If a screen is present (e.g. to request customer authentication) the issuer app must use the row selector button instead". The badge artwork itself is licensed for web pages, email and print; for apps Apple points to `PKAddPassButton`.

Show the row only when it starts the native add. When the card is on every eligible device, replace it with text such as "Added to Apple Wallet".
