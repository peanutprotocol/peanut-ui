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
