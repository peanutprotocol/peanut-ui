/**
 * Cache Storage helpers shared by logout (user-scoped purge) and the
 * stale-deployment reload (document-scoped purge).
 */

/**
 * Deletes every Cache Storage entry whose name contains one of `patterns`.
 * Substring matching because Serwist prefixes and suffixes its cache names
 * (`serwist-<name>-<scope>`).
 *
 * Never throws: a failed purge must not break logout or block a reload.
 */
export async function purgeCaches(patterns: readonly string[]): Promise<void> {
    if (typeof window === 'undefined' || !('caches' in window)) return
    try {
        const cacheNames = await caches.keys()
        await Promise.all(
            cacheNames
                .filter((name) => patterns.some((pattern) => name.includes(pattern)))
                .map((name) => caches.delete(name))
        )
    } catch (e) {
        console.warn('failed to purge caches:', e)
    }
}

/**
 * True when the current browser window is an installed PWA.
 *
 * Existing installs remain reachable until the native migration cutoff.
 * Android standalone reloads can leave the app window and open Chrome, so
 * reload callers must keep a standalone-safe path during that transition.
 */
export function isStandalonePwa(): boolean {
    if (typeof window === 'undefined') return false
    try {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true
        )
    } catch {
        return false
    }
}
