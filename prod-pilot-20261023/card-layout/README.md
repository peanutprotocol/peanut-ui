# Card layout review

Actual app from signed private production builds, with synthetic API fixture state. This is surface evidence, not provider, chain or full end-to-end validation.

Before: `95aaabd8a4d296f3c5e41720a61b19024e8b8f12`. After: `10ba4fe1321cb94fdffa33cf1df60b840f8a87d6`.

The card-stop banner now stacks above the card. The card retains its minimum aspect ratio but grows for larger text, and its brand header wraps within the card width.

Each folder contains six translated banner states at 320 × 568, holder views at 100%, 150% and 200% text, one 200% card-element detail, and a short scroll video. Only the synthetic fixture overlay is hidden for review, following the repository screenshot convention. Product banners, navigation, fonts and text remain unchanged. The detail scrolls the card into view; it does not hide navigation or edit the screenshot.

The original normal geometry checks passed for all 29 card fixtures in three locales (87 tests). All 28 card stress checks passed, including 150% and 200% text. Baseline checks reproduced the six translated banner failures and the enlarged holder failures. The final signed source and e2e inputs were unchanged across capture; manifest.json records the hashes.

The captures show masked card details only. Revealed details, loading, passkeys and native-app behavior are not proved here. Separate shared-screen stress and locale fixture failures remain documented in the PR; these captures do not clear them. Assets are temporary PR evidence for deletion after merge.
