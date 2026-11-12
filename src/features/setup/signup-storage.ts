import { isNativeBridge } from '@/utils/capacitor'
import { readStoredValue, removeStoredValue, writeStoredValue } from '@/utils/safe-storage'

const writes = new Map<string, Promise<void>>()

async function bounded<T>(operation: Promise<T>): Promise<T | null> {
    let timer: ReturnType<typeof setTimeout> | undefined
    return Promise.race([
        operation,
        new Promise<null>((resolve) => {
            timer = setTimeout(() => resolve(null), 1500)
        }),
    ]).finally(() => clearTimeout(timer))
}

export function storeSignupValue(key: string, value: string | null): Promise<void> {
    if (value === null) removeStoredValue(key)
    else writeStoredValue(key, value)
    if (!isNativeBridge?.()) return Promise.resolve()
    const previous = writes.get(key) ?? Promise.resolve()
    const write = previous.then(async () => {
        try {
            const { Preferences } = await import('@capacitor/preferences')
            if (value === null) await Preferences.remove({ key })
            else await Preferences.set({ key, value })
        } catch {
            // WebView storage remains the fallback when the native plugin is unavailable.
        }
    })
    writes.set(key, write)
    void write.finally(() => {
        if (writes.get(key) === write) writes.delete(key)
    })
    return bounded(write).then(() => {})
}

export async function restoreSignupValue(key: string): Promise<string | null> {
    const local = readStoredValue(key)
    if (!isNativeBridge?.() || local !== null) return local
    try {
        const pending = writes.get(key)
        if (pending && (await bounded(pending.then(() => true))) === null) return readStoredValue(key)
        const { Preferences } = await import('@capacitor/preferences')
        const result = await bounded(Preferences.get({ key }))
        if (readStoredValue(key) !== local) return readStoredValue(key)
        if (result?.value) {
            writeStoredValue(key, result.value)
            return result.value
        }
    } catch {}
    return local
}
