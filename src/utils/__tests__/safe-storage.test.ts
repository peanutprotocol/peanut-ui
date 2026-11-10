/**
 * The failure this guards (Sentry PEANUT-UI-STC / PEANUT-UI-STF) is not a
 * throwing getItem — it is `window.localStorage` itself being null or throwing
 * SecurityError in restricted Android in-app browsers, which took out startup
 * locale detection and wagmi's module-scope createConfig.
 */
import {
    readStoredValue,
    removeStoredValue,
    resilientWebStorage,
    storedKeysWithPrefix,
    webStorage,
    writeStoredValue,
} from '../safe-storage'

const realStorage = Object.getOwnPropertyDescriptor(window, 'localStorage')!

function stubLocalStorage(get: () => Storage | null): void {
    Object.defineProperty(window, 'localStorage', { get, configurable: true })
}

afterEach(() => {
    Object.defineProperty(window, 'localStorage', realStorage)
})

it('reads and writes through a healthy localStorage', () => {
    writeStoredValue('k', 'v')
    expect(readStoredValue('k')).toBe('v')
    removeStoredValue('k')
    expect(readStoredValue('k')).toBeNull()
})

it('lists only the stored keys with the prefix asked', () => {
    writeStoredValue('mark:u1:a', '1')
    writeStoredValue('mark:u1:b', '2')
    writeStoredValue('mark:u10:c', '3')
    expect(storedKeysWithPrefix('mark:u1:').sort()).toEqual(['mark:u1:a', 'mark:u1:b'])
    localStorage.clear()
})

it('lists no keys where storage is missing or cannot be listed', () => {
    stubLocalStorage(() => null)
    expect(storedKeysWithPrefix('mark:')).toEqual([])
    stubLocalStorage(
        () =>
            ({
                length: 1,
                key: () => {
                    throw new DOMException('denied', 'SecurityError')
                },
            }) as unknown as Storage
    )
    expect(storedKeysWithPrefix('mark:')).toEqual([])
})

it('treats a null localStorage as empty instead of dereferencing it', () => {
    stubLocalStorage(() => null)
    expect(readStoredValue('k')).toBeNull()
    expect(() => writeStoredValue('k', 'v')).not.toThrow()
    expect(() => removeStoredValue('k')).not.toThrow()
})

it('survives a localStorage property getter that throws SecurityError', () => {
    const hostile = {
        get localStorage(): Storage {
            throw new DOMException('The operation is insecure.', 'SecurityError')
        },
    }
    expect(webStorage(hostile)).toBeNull()
})

it('treats a host without localStorage (SSR) as empty', () => {
    expect(webStorage({})).toBeNull()
})

it('survives storage methods that throw once reached', () => {
    const throwing = {
        getItem: () => {
            throw new DOMException('denied', 'SecurityError')
        },
        setItem: () => {
            throw new DOMException('QuotaExceeded', 'QuotaExceededError')
        },
        removeItem: () => {
            throw new DOMException('denied', 'SecurityError')
        },
    } as unknown as Storage
    stubLocalStorage(() => throwing)

    expect(resilientWebStorage.getItem('k')).toBeNull()
    expect(() => resilientWebStorage.setItem('k', 'v')).not.toThrow()
    expect(() => resilientWebStorage.removeItem('k')).not.toThrow()
})
