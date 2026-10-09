# Android screen-wake blank screen

Reported on Motorola, running 1.7.2-a: leave Peanut open until the display
times out, then wake/unlock. The previous screen appears briefly and then
becomes blank. Switching to another app and back restores it.

## Recovery

PR #3504 recovers a **dead** renderer through `onRenderProcessGone`. It is
included in the 1.7 native release line. It does not redraw a still-live
WebView when its window regains focus.

`WebViewRepaint` coordinates a refresh after Activity resume **and** window
focus, including focus-only transitions. It posts onto the next UI frame,
invalidates stale callbacks across pause/focus loss/destruction, and coalesces
duplicate callbacks. `MainActivity` resumes the existing WebView, requests
layout and invalidation, then requests another draw after Chromium's visual
state callback. It leaves the document, route, forms, scroll and bridge intact.
Dead-renderer rebuilds remain owned by `RendererRecovery`.

Two generic native Sentry breadcrumbs distinguish a repaint request from a
Chromium visual-state acknowledgement. They contain no URLs or page data;
the acknowledgement alone does not prove the user saw the correct pixels.

## Validation and limits

Unit tests cover both focus/resume orderings, focus-only recovery, rapid
relocking, duplicate callbacks, repeated cycles and destruction. Android
instrumentation covers actual display timeout, repeated sleep/wake and
switching apps after wake. A controlled late WebView pause also checks that
focus return can restore animation frames without another Activity resume.
The suite checks the same Activity, WebView, document and
unsent input remain, plus window pixels immediately and after 750 ms to catch
the reported flash-then-blank behavior.

Local checks passed: 16 native JVM tests, all eight instrumentation tests on
Android 15 / API 35, and 47 native fingerprint/OTA scope guards. The controlled
late-pause test fails against the unchanged `MainActivity` at the frame-resume
assertion and passes with this change. This demonstrates that recovery path;
it does not reproduce the reported Motorola failure.

Run on a disposable unlocked test emulator/device (display settings are
temporarily changed and restored):

```sh
cd android
./gradlew :app:testDebugUnitTest :app:connectedDebugAndroidTest
```

This is a native mitigation for the missing live-page redraw path. The exact
Motorola failure is not yet reproduced; compositor/focus behavior remains a
hypothesis, not a confirmed root cause. A minimal local HTML fixture validates
the native lifecycle and pixels but does not establish production wallet-flow
acceptance. Requires a new Android binary; OTA cannot deliver this Java code.

Before closing the report, verify on the reported Motorola with the production
bundle: actual display timeout and power-button lock; repeated wake/unlock;
quiet and animated screens; an unsent form; app switching; and a native SDK
or passkey round trip. Content must remain visible beyond the first frame,
without restarting, losing state or replaying a deep link.
