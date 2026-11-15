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
    /** Present on a real Storage: lets a caller list its own keys by prefix. */
    readonly length?: number
    key?(index: number): string | null
}

/** The browser's lasting store, or this tab's session store, which goes when the tab closes. */
export type StorageArea = 'localStorage' | 'sessionStorage'

type StorageHost = Partial<Record<StorageArea, WebStorageLike | null>>

// `host` is a test seam: jest's jsdom global swallows throwing property
// getters, so the SecurityError path is only reachable with an explicit host.
export function webStorage(host: StorageHost = globalThis, area: StorageArea = 'localStorage'): WebStorageLike | null {
    try {
        return host[area] ?? null
    } catch {
        return null
    }
}

export function readStoredValue(key: string, area: StorageArea = 'localStorage'): string | null {
    const storage = webStorage(globalThis, area)
    if (!storage) return null
    try {
        return storage.getItem(key)
    } catch {
        return null
    }
}

export function writeStoredValue(key: string, value: string, area: StorageArea = 'localStorage'): void {
    const storage = webStorage(globalThis, area)
    if (!storage) return
    try {
        storage.setItem(key, value)
    } catch {
        // quota exceeded or storage disabled mid-session
    }
}

/** The stored keys that start with `prefix`; none where storage cannot be read or listed. */
export function storedKeysWithPrefix(prefix: string): string[] {
    const storage = webStorage()
    if (!storage || typeof storage.key !== 'function' || typeof storage.length !== 'number') return []
    try {
        const keys: string[] = []
        for (let index = 0; index < storage.length; index++) {
            const key = storage.key(index)
            if (key?.startsWith(prefix)) keys.push(key)
        }
        return keys
    } catch {
        return []
    }
}

export function removeStoredValue(key: string, area: StorageArea = 'localStorage'): void {
    const storage = webStorage(globalThis, area)
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

/** Session-only storage with the same restricted-browser fallback as local storage. */
export const resilientSessionStorage: WebStorageLike = {
    getItem(key) {
        try {
            return webStorage(globalThis, 'sessionStorage')?.getItem(key) ?? null
        } catch {
            return null
        }
    },
    setItem(key, value) {
        try {
            webStorage(globalThis, 'sessionStorage')?.setItem(key, value)
        } catch {}
    },
    removeItem(key) {
        try {
            webStorage(globalThis, 'sessionStorage')?.removeItem(key)
        } catch {}
    },
}
