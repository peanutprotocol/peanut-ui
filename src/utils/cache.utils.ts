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
 * True when running as an installed PWA rather than a browser tab.
 *
 * Load-bearing for reload decisions: `window.location.reload()` in an Android
 * standalone session can bounce the user out to Chrome (see the sw-registration
 * script in layout.tsx), so callers navigate differently here.
 */
export function isStandalonePwa(): boolean {
    if (typeof window === 'undefined') return false
    try {
        return (
            window.matchMedia('(display-mode: standalone)').matches ||
            (navigator as Navigator & { standalone?: boolean }).standalone === true
        )
    } catch {
        // matchMedia unavailable -> assume not standalone
        return false
    }
}
