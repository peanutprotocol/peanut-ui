/*
 * Restricted documents — Android in-app browsers, Chrome with site data
 * blocked — expose `localStorage` as null or throw SecurityError from the
 * property getter itself, so even reaching for it has to be guarded. Every
 * caller degrades to "no stored value" rather than throwing.
 */

type WebStorageLike = {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
}

type StorageHost = { localStorage?: WebStorageLike | null }

// `host` is a test seam: jest's jsdom global swallows throwing property
// getters, so the SecurityError path is only reachable with an explicit host.
export function webStorage(host: StorageHost = globalThis): WebStorageLike | null {
    try {
        return host.localStorage ?? null
    } catch {
        return null
    }
}

export function readStoredValue(key: string): string | null {
    const storage = webStorage()
    if (!storage) return null
    try {
        return storage.getItem(key)
    } catch {
        return null
    }
}

export function writeStoredValue(key: string, value: string): void {
    const storage = webStorage()
    if (!storage) return
    try {
        storage.setItem(key, value)
    } catch {
        // quota exceeded or storage disabled mid-session
    }
}

export function removeStoredValue(key: string): void {
    const storage = webStorage()
    if (!storage) return
    try {
        storage.removeItem(key)
    } catch {
        // storage disabled mid-session
    }
}

/**
 * Drop-in for wagmi's `getDefaultStorage()`, which reads `window.localStorage`
 * unguarded and leaves only `setItem` in a try/catch — enough for `createConfig`
 * at module scope to throw and take the whole app shell down.
 */
export const resilientWebStorage: WebStorageLike = {
    getItem: readStoredValue,
    setItem: writeStoredValue,
    removeItem: removeStoredValue,
}
