import { getPathMatch } from 'next/dist/shared/lib/router/utils/path-match'
import redirectRules from '../../../../redirects.json'
import { GO_REDIRECTS, goRedirectDestination, resolveGoRedirect } from '@/features/tracked-links/go-map'

// The key rule of go-map.ts's header: lowercase segments of letters, digits, `-` and `_`.
const KEY = /^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/

// A loop, not it.each, so an empty map still passes.
it('keeps every GO_REDIRECTS entry on peanut.me and out of /go/', () => {
    for (const [key, target] of Object.entries(GO_REDIRECTS)) {
        expect(key).toMatch(KEY)
        // A bad line fails naming its key. This is the route's own lookup on the live map.
        expect([key, resolveGoRedirect(key.split('/'))]).toEqual([key, target])
    }
})

// next.config.js runs redirects.json before the /go/ page. A rule whose source matches /go/<key> takes that key.
const rules = redirectRules.filter((rule) => !('has' in rule))
const takenAsSource = (key: string) => rules.some((rule) => getPathMatch(rule.source)(`/go/${key}`))
// A rule that sends /go/<x> on to another /go/ path makes that path a cached 308 alias, so its key is taken too.
const takenAsDestination = new Set(
    rules.flatMap((rule) => {
        if (!rule.source.startsWith('/:locale/') || !rule.destination.startsWith('/:locale/')) return []
        const key = rule.destination.slice('/:locale/'.length)
        return getPathMatch(rule.source)(`/go/${rule.source.slice('/:locale/'.length)}`) && !key.includes(':')
            ? [key]
            : []
    })
)

it('uses no key that a redirects.json rule answers or redirects to', () => {
    expect(takenAsSource('team')).toBe(true)
    for (const key of ['press', 'content', 'deposit/via-spei']) expect(takenAsDestination.has(key)).toBe(true)
    for (const key of Object.keys(GO_REDIRECTS)) {
        expect([key, takenAsSource(key), takenAsDestination.has(key)]).toEqual([key, false, false])
    }
})

describe('resolveGoRedirect', () => {
    it('answers the live map, ignoring case', () => {
        expect(resolveGoRedirect(['app'])).toBe('/app')
        expect(resolveGoRedirect(['APP'])).toBe('/app')
    })

    it('misses an unknown key and extra segments', () => {
        expect(resolveGoRedirect(['konrad', '1'])).toBeNull()
        expect(resolveGoRedirect(['app', 'x'])).toBeNull()
    })

    it.each(['constructor', '__proto__', 'tostring', 'toString', 'hasOwnProperty'])(
        'never reads %s from the object prototype',
        (key) => {
            expect(resolveGoRedirect([key])).toBeNull()
        }
    )
})

describe('goRedirectDestination', () => {
    it('keeps the path, query and hash', () => {
        expect(goRedirectDestination('/en/pricing?utm_source=flyer#fees')).toBe('/en/pricing?utm_source=flyer#fees')
    })

    it.each([
        ['a relative path', 'app'],
        ['a full URL, even ours', 'https://peanut.me/app'],
        ['another site', 'https://evil.com/x'],
        ['a protocol-relative URL', '//evil.com'],
        ['userinfo on another host', '//u:p@evil.com/x'],
        ['a backslash', '/\\evil.com'],
        ['an encoded slash pair', '/%2F%2Fevil.com'],
        ['an encoded backslash', '/%5Cevil.com'],
        ['a /go/ loop', '/go/x'],
        ['an upper-case /go/ loop', '/GO/x'],
        ['a dot-segment /go/ loop', '/./go/x'],
        ['/go itself', '/go'],
    ])('refuses %s', (_case, target) => {
        expect(goRedirectDestination(target)).toBeNull()
    })

    it('answers only the path for userinfo on peanut.me', () => {
        expect(goRedirectDestination('//u@peanut.me/x')).toBe('/x')
    })

    // An encoded tab is not stripped like a raw one, so the browser stays on peanut.me.
    it('keeps an encoded tab on peanut.me', () => {
        const out = goRedirectDestination('/%09/evil.com')!
        expect(new URL(out, 'https://peanut.me').origin).toBe('https://peanut.me')
    })
})
