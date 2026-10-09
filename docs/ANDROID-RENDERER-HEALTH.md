# Android renderer health

WebView renderer loss is reported with `renderer.did_crash`,
`renderer.foreground`, `renderer.recovery_scheduled`, and priority-at-exit.
Recoverable non-crash loss in the background is an info diagnostic. Crashes,
foreground loss, and loss that cannot recover are errors. The existing recovery
waits until the Activity resumes and prevents repeated-recreate loops.

Compilation and all nine Android unit tests pass. This reporting change needs a
new native binary and physical-device acceptance: reclaim the background renderer,
resume to the existing destination, exercise a foreground renderer crash, preserve
a new deep link received during recovery, and verify repeat-loss loop protection.

This change does not establish that every native crash cause has been fixed or
change the denominator of native process crash-free sessions.
