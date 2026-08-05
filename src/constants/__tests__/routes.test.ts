import fs from 'fs'
import path from 'path'
import { DEDICATED_ROUTES, couldBeRecipient, isLocaleSegment, isReservedRoute } from '../routes'

// Guards against the "/card/foo → invalid recipient" class of bug: every
// folder that resolves to a real Next.js route under src/app/ must be
// listed in DEDICATED_ROUTES, or unknown sub-paths get swallowed by the
// [...recipient] catch-all and reinterpreted as a payment.
const APP_DIR = path.resolve(__dirname, '../../app')

// Files that mark a directory as a real Next.js route (page) or handler.
const ROUTE_FILES = new Set(['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.ts', 'route.js'])

function containsRouteFile(dir: string): boolean {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isFile() && ROUTE_FILES.has(entry.name)) return true
        if (entry.isDirectory() && containsRouteFile(path.join(dir, entry.name))) return true
    }
    return false
}

// Collect first-URL-segment names by walking src/app/ and unwrapping route
// groups `(name)`. Skip dynamic segments `[name]` — those are the catch-alls
// themselves, not things to reserve from them.
function collectRouteSegments(dir: string): string[] {
    const out: string[] = []
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue
        if (entry.name.startsWith('[')) continue
        const childPath = path.join(dir, entry.name)
        if (entry.name.startsWith('(')) {
            out.push(...collectRouteSegments(childPath))
            continue
        }
        if (containsRouteFile(childPath)) out.push(entry.name)
    }
    return out
}

describe('DEDICATED_ROUTES', () => {
    it('reserves every top-level route folder under src/app/', () => {
        const segments = Array.from(new Set(collectRouteSegments(APP_DIR)))
        const missing = segments.filter((s) => !(DEDICATED_ROUTES as readonly string[]).includes(s))
        expect(missing).toEqual([])
    })
})

describe('couldBeRecipient — catch-all guard', () => {
    test('accepts valid Peanut usernames', () => {
        expect(couldBeRecipient('hugo0')).toBe(true)
        expect(couldBeRecipient('konrad')).toBe(true)
        expect(couldBeRecipient('alice123')).toBe(true)
    })

    test('accepts EVM addresses and ENS names', () => {
        expect(couldBeRecipient('0x1234567890123456789012345678901234567890')).toBe(true)
        expect(couldBeRecipient('vitalik.eth')).toBe(true)
    })

    test('accepts username@chain handles', () => {
        expect(couldBeRecipient('hugo0@arbitrum')).toBe(true)
        expect(couldBeRecipient('hugo0@optimism')).toBe(true)
    })

    test('accepts address@chainId deep links (EIP-681 scanner path)', () => {
        expect(couldBeRecipient('0x1234567890123456789012345678901234567890@42161')).toBe(true)
        expect(couldBeRecipient('0x1234567890123456789012345678901234567890%4042161')).toBe(true)
        expect(couldBeRecipient('vitalik.eth@arbitrum')).toBe(true)
    })

    test('rejects bare 2-letter locale codes (the /es/argentina regression)', () => {
        expect(couldBeRecipient('es')).toBe(false)
        expect(couldBeRecipient('pt')).toBe(false)
        expect(couldBeRecipient('en')).toBe(false)
        expect(couldBeRecipient('fr')).toBe(false)
        expect(couldBeRecipient('de')).toBe(false)
    })

    test('rejects strings shorter than the username minimum', () => {
        expect(couldBeRecipient('a')).toBe(false)
        expect(couldBeRecipient('ab')).toBe(false)
        expect(couldBeRecipient('abc')).toBe(false)
    })

    test('rejects strings with characters usernames forbid', () => {
        expect(couldBeRecipient('send-money-to')).toBe(false)
        expect(couldBeRecipient('123foo')).toBe(false)
        expect(couldBeRecipient('foo.bar')).toBe(false)
    })

    test('case-insensitive: uppercase usernames resolve via lowercasing', () => {
        // matches the existing PaymentPage behavior — recipient is lowercased before lookup
        expect(couldBeRecipient('UPPER')).toBe(true)
        expect(couldBeRecipient('Hugo0')).toBe(true)
    })

    test('rejects empty / undefined-shaped input', () => {
        expect(couldBeRecipient('')).toBe(false)
    })

    test('rejects malformed percent-encoding without throwing', () => {
        expect(() => couldBeRecipient('%')).not.toThrow()
        expect(couldBeRecipient('%')).toBe(false)
        expect(couldBeRecipient('%E0%A4%A')).toBe(false)
    })
})

describe('isLocaleSegment', () => {
    test('matches locale codes with a subtag', () => {
        expect(isLocaleSegment('pt-br')).toBe(true)
        expect(isLocaleSegment('es-419')).toBe(true)
        expect(isLocaleSegment('zh-Hans')).toBe(true)
    })

    test('does NOT match bare 2-letter codes (those rely on DEDICATED_ROUTES + redirects.json)', () => {
        expect(isLocaleSegment('es')).toBe(false)
        expect(isLocaleSegment('pt')).toBe(false)
    })
})

describe('isReservedRoute', () => {
    test('catches DEDICATED_ROUTES entries', () => {
        expect(isReservedRoute('/home')).toBe(true)
        expect(isReservedRoute('/send')).toBe(true)
        expect(isReservedRoute('/es-419')).toBe(true)
    })

    test('catches subtagged locales via isLocaleSegment', () => {
        expect(isReservedRoute('/zh-Hans')).toBe(true)
    })

    test('does not flag plausible usernames', () => {
        expect(isReservedRoute('/hugo0')).toBe(false)
    })
})
