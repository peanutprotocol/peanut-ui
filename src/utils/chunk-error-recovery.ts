/**
 * Recovery for chunk-load failures.
 *
 * When a webpack chunk fails to load — deploy skew (the open page is pinned to
 * a deployment whose assets are gone) or a transient network failure — Next.js
 * throws a ChunkLoadError. Depending on where it surfaces the user either
 * dead-ends on the static "Application error: a client-side exception has
 * occurred" screen, gets an error boundary whose "Try again" re-renders
 * against the same dead deployment (can never succeed under skew), or — for
 * lazy components behind LazyLoadErrorBoundary — UI that silently vanishes.
 * Reloading the page is the one real fix: refetching the HTML re-pins to the
 * current deployment, so its chunks resolve.
 *
 * Two delivery mechanisms for the same logic, because one cannot cover both:
 *
 * 1. CHUNK_ERROR_RECOVERY_SCRIPT — inline beforeInteractive <Script> in the
 *    root layout, for UNCAUGHT chunk errors. It must be inline: error.tsx /
 *    global-error.jsx are themselves lazy chunks and fail to load under the
 *    exact same conditions (PostHog $exception, 2026-05-26 spike: the top
 *    failing chunks WERE the error pages). Inline-with-the-HTML is the only
 *    code guaranteed to be in memory at error time.
 * 2. recoverFromChunkError() — for chunk errors CAUGHT by a React error
 *    boundary (those never reach the window listeners). Called from the
 *    error boundaries; bundled code is fine there because the boundary
 *    demonstrably loaded.
 *
 * Both share the same sessionStorage guard (one auto-reload per 60s) so they
 * can't compound into a reload loop; when the guard blocks, behavior degrades
 * to exactly what it was before this existed. Standalone PWA mode is excluded
 * because window.location.reload() there can bounce the user out to the
 * browser (see the sw-registration script in layout.tsx).
 */

const GUARD_KEY = 'peanut-chunk-reload-at'
const GUARD_MS = 60_000
const CHUNK_ERROR_RE = /ChunkLoadError|Loading chunk \S+ failed|Loading CSS chunk|dynamically imported module/

export function isChunkLoadError(error: unknown): boolean {
    if (!error) return false
    if (typeof error === 'string') return CHUNK_ERROR_RE.test(error)
    const candidate = error as { name?: unknown; message?: unknown }
    return candidate.name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(String(candidate.message ?? ''))
}

/**
 * Reload-once recovery for chunk errors caught by React error boundaries.
 * No-op for non-chunk errors. Returns true if a reload was triggered (callers
 * can keep their fallback UI for the false case).
 */
export function recoverFromChunkError(error: unknown): boolean {
    if (typeof window === 'undefined' || !isChunkLoadError(error)) return false
    let isStandalone = false
    try {
        isStandalone =
            window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true
    } catch {
        // matchMedia unavailable -> assume not standalone
    }
    if (isStandalone) return false
    try {
        const last = Number(sessionStorage.getItem(GUARD_KEY) || 0)
        if (Date.now() - last < GUARD_MS) return false
        sessionStorage.setItem(GUARD_KEY, String(Date.now()))
    } catch {
        // no sessionStorage -> no loop protection -> don't auto-reload
        return false
    }
    window.location.reload()
    return true
}

export const CHUNK_ERROR_RECOVERY_SCRIPT = `
(function () {
    var GUARD_KEY = '${GUARD_KEY}';
    var GUARD_MS = ${GUARD_MS};
    var CHUNK_ERROR_RE = /${CHUNK_ERROR_RE.source}/;

    function isChunkError(err) {
        if (!err) return false;
        if (typeof err === 'string') return CHUNK_ERROR_RE.test(err);
        return err.name === 'ChunkLoadError' || CHUNK_ERROR_RE.test(String(err.message || ''));
    }

    function recover() {
        var isStandalone = false;
        try {
            isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
        } catch (e) {}
        if (isStandalone) return;
        try {
            var last = Number(sessionStorage.getItem(GUARD_KEY) || 0);
            if (Date.now() - last < GUARD_MS) return;
            sessionStorage.setItem(GUARD_KEY, String(Date.now()));
        } catch (e) {
            // no sessionStorage -> no loop protection -> don't auto-reload
            return;
        }
        window.location.reload();
    }

    window.addEventListener('unhandledrejection', function (event) {
        if (isChunkError(event.reason)) recover();
    });
    window.addEventListener(
        'error',
        function (event) {
            if (isChunkError(event.error || event.message)) recover();
        },
        true
    );
})();
`
