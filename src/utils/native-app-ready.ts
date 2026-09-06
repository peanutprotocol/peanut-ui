/**
 * notifyAppReady(), before any webpack chunk has to load.
 *
 * Capgo applies a staged bundle from appMovedToBackground(), so the reload
 * lands in a process Android is about to freeze. Freezing stops threads but not
 * the clock: on resume every overdue setTimeout fires at once, including
 * webpack's 120 s chunkLoadTimeout, and every in-flight import() rejects with a
 * ChunkLoadError for a local file that was never missing. notifyAppReady used
 * to sit behind two of those imports plus React hydration, so it was never
 * called and Capgo rolled the bundle back (PEANUT-UI-SVT: booted at 13:46:04,
 * resumed 23m46s later, four ChunkLoadErrors and a rollback inside 40 ms).
 *
 * Delivered as a raw inline script for the same reason as the chunk-error
 * recovery next to it in the root layout: it must be in memory before the first
 * chunk request, not queued behind Next's bootstrap chunk. Capacitor injects
 * window.Capacitor.Plugins.<Name> stubs at document start on both platforms
 * (JSExport.java / JSExport.swift), so the plugin is callable with no app JS.
 *
 * initCapgoUpdater() still calls notifyAppReady() as well. It is idempotent —
 * setSuccess plus a semaphoreDown that no-ops with no pending wait — and it is
 * the fallback for any binary whose bridge does not expose the stub.
 */

/*
 * Calling notifyAppReady this early gives up Capgo's rollback net: the bundle
 * is marked SUCCESS before it has proved it can boot. This counter is the
 * replacement, and it is the better net — Capgo cannot tell a bundle whose JS
 * is broken from one the OS froze, and rolled back on both. A frozen boot
 * eventually finishes and clears the counter; a broken one never does.
 */
const BOOT_INCOMPLETE_KEY = 'peanutNativeBootIncomplete'
const BOOT_INCOMPLETE_LIMIT = 3

/** The app rendered, so whatever bundle is running boots. Clears the counter. */
export function markNativeBootComplete(): void {
    try {
        window.localStorage.removeItem(BOOT_INCOMPLETE_KEY)
    } catch {
        // private mode or a storage-less WebView: the counter never accumulates
        // either, so there is nothing to clear
    }
}

export const NATIVE_APP_READY_SCRIPT = `
(function () {
    var plugins = window.Capacitor && window.Capacitor.Plugins;
    var updater = plugins && plugins.CapacitorUpdater;
    if (!updater || typeof updater.notifyAppReady !== 'function') return;

    var KEY = '${BOOT_INCOMPLETE_KEY}';
    var LIMIT = ${BOOT_INCOMPLETE_LIMIT};
    var failures = 0;
    try { failures = Number(localStorage.getItem(KEY)) || 0; } catch (e) {}

    // Three launches that never rendered: the bundle is the problem, not the
    // scheduler. Fall back to the builtin one instead of marking this ready.
    if (failures >= LIMIT && typeof updater.reset === 'function') {
        try { localStorage.removeItem(KEY); } catch (e) {}
        try { updater.reset({}); } catch (e) {}
        return;
    }

    try { localStorage.setItem(KEY, String(failures + 1)); } catch (e) {}
    try { updater.notifyAppReady(); } catch (e) {}
})();
`
