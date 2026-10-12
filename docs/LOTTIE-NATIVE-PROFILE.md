# Lottie native WebView validation

This branch answers TASK-21683's remaining question: whether the live SVG Lottie rig is acceptable inside Peanut's real Capacitor WebViews.

## Why a device run is required

Desktop Chromium throttling showed the SVG renderer holding 60 fps while using materially more main-thread time than the raster mascot. It cannot reproduce Android WebView rasterization, device thermals, or iOS WebKit behavior. Native Lottie views are not a substitute because a sibling native view cannot interleave with the WebView DOM, scrolling, or z-order.

## Test surface

Open `/dev/lottie-profile` in the native build. It renders the production `PeanutMascot` component and reports:

- average requestAnimationFrame cadence;
- p95 and worst frame interval;
- frames longer than 34 ms;
- Chromium long-task count and duration where supported;
- mounted Lottie hosts and SVGs;
- platform, native-bridge, WebView, CPU-thread, and device-memory metadata.

The page defaults to `walking`, the heaviest rig in the original desktop measurements.

## Signed profile builds

This branch has a narrow profile mode in the existing native workflows. It keeps only `/dev/lottie-profile` (plus the existing deferred-link test route), opens that route through the production dev gate, and enables WebView inspection. Normal builds still prune and block the profiler.

- Dispatch **App Release iOS** from `innolope/TASK-21683-lottie-native-testflight` with `versionName` blank. It reuses the current native marketing version, uploads a new build number to TestFlight, and does not publish a production OTA.
- Dispatch **App Release Android** from the same branch with `versionName` blank and `track=internal`. It uploads a new version code to Play internal, does not write a replacement tag, and does not publish a production OTA. Any other track is rejected.
- Open `https://peanut.me/dev/lottie-profile` on the device. The profile build's deep-link mapper routes that exact URL into the bundled page; other production `/dev` routes remain blocked.

## Required runs

1. Cold-launch an unplugged floor Android device and open `/dev/lottie-profile`.
2. Run `walking` with 1, 3, and 10 instances.
3. Capture a Chrome Performance trace during the 3-instance run.
4. Leave the page active for five minutes, then repeat the three runs to expose thermal drift.
5. On the iOS TestFlight build, run `waving-chill` with 1 and 3 instances.
6. Record visible stalls, blank SVGs, WebView reloads, touch/scroll latency, device model, OS, and build SHA alongside the numeric result.

## Decision

Ship the live rig only if the single-mascot production case remains visually smooth on the floor Android device, does not create recurring long tasks or interaction lag, and does not materially degrade after the thermal repeat. The 3- and 10-instance runs are stress diagnostics, not production acceptance cases.

If the single instance fails, keep the Lottie files as the vector source and replace runtime playback with generated raster output. Do not add native Lottie overlays: they cannot preserve DOM composition and scrolling behavior.
