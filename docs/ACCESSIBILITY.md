# Accessibility

Profile → Accessibility opens `/settings/accessibility`. Preferences are stored
on the current device under `peanut_accessibility_v1` and update open tabs.

- **Larger text:** increases the shared typography scale by 25%. Controls and
  headings can wrap; icon sizes and the spacing scale stay unchanged. Browser
  zoom remains available.
- **Reduce motion:** follows the device by default, with explicit On/Off choices.
  CSS, shared Motion components, counters, marquees, optional tutorial videos,
  celebrations, avatar rolls and the rewards graph use the effective preference.
- **Increase contrast:** strengthens secondary text, borders and focus indicators.
  Error text also has improved contrast in the default theme.
- **Simplified confirmations:** replaces holding/sliding with a named button and
  a separate cancellable confirmation. Keyboard and assistive clicks can use this
  confirmation step without enabling the preference.

Screen-reader labels, keyboard focus and non-color status cues are part of shared
controls and do not require a toggle. VoiceOver and Voice Control use the device's
accessibility support; this implementation does not generate recorded speech.

## Verification

`/dev/accessibility` is a local/preview-only fixture using the real settings,
confirmation controls, status badges and drawer. Its actions increment a local
counter and do not send money. The preview drawer uses 24px horizontal and bottom
padding, with 16px gaps between its content.

Automated coverage includes preference persistence and device changes, restricted
storage, cancellable/once-only confirmations, busy controls, modal naming, drawer
focus restoration, card actions, and semantic color contrast ratios.

Before release, check real device behavior with VoiceOver and Voice Control:

1. Navigate Profile → Accessibility. Toggle each preference, reload, and verify
   its value and effect remain. Try 320px width, larger text and browser zoom.
2. Open and dismiss a dialog/drawer with keyboard, screen reader and voice. Check
   its title, focus containment and return to the opening control.
3. In a test account, review send/claim/card confirmations, cancel first, then
   confirm once. Check pending, success and failure announcements and retry.
4. Check reduced motion during onboarding, reward claiming and avatar selection.
5. Check native and third-party verification/support flows separately: their
   internal accessibility is not controlled by Peanut's shared components.

Browser keyboard and accessibility-tree checks are not a substitute for these
native assistive-technology checks.
