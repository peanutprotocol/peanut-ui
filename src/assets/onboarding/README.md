# Signup animations

Byte-identical SVG Lottie exports from `peanutprotocol/mono`, commit `ef81ea66e`, directory `projects/onboarding-animations`:

| Local asset | Library export |
| --- | --- |
| card.json | 03-card-mascot.json |
| bank.json | 04-bank-mascot.json |
| fees.json | 09-fees-mascot.json |
| security.json | 10-security-object.json |
| notifications.json | 13-notifications-mascot.json |

`OnboardingAnimation` loads each export on demand, pauses hidden pages, and shows the first frame for reduced-motion users. Clouds and stars come from the shared setup wrapper.
