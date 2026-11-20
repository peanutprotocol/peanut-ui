import {
    GO_REDIRECT_KEY,
    GO_REDIRECTS,
    goRedirectDestination,
    resolveGoRedirect,
} from '@/features/tracked-links/go-map'

// A loop, not it.each, so an empty map still passes.
it('keeps every GO_REDIRECTS entry on peanut.me and out of /go/', () => {
    for (const [key, target] of Object.entries(GO_REDIRECTS)) {
        expect(key).toMatch(GO_REDIRECT_KEY)
        expect(target.startsWith('/')).toBe(true)
        expect(target).not.toMatch(/^\/go(\/|$|\?|#)/i)
        expect(goRedirectDestination(target)).toBe(target)
    }
})

describe('resolveGoRedirect', () => {
    const redirects = {
        flyer: '/en/pricing?utm_source=flyer#fees',
        'lisbon/print-1': '/app',
        evil: 'https://evil.com/x',
        protocol: '//evil.com',
        backslash: '/\\evil.com',
        encoded: '/%2F%2Fevil.com',
        loop: '/go/x',
        dotloop: '/./go/x',
        bare: '/go',
    }

    it('answers the path for an exact key', () => {
        expect(resolveGoRedirect(['flyer'], redirects)).toBe('/en/pricing?utm_source=flyer#fees')
    })

    it('ignores case', () => {
        expect(resolveGoRedirect(['Lisbon', 'PRINT-1'], redirects)).toBe('/app')
    })

    it('joins the segments into one key', () => {
        expect(resolveGoRedirect(['lisbon', 'print-1'], redirects)).toBe('/app')
        expect(resolveGoRedirect(['lisbon'], redirects)).toBeNull()
        expect(resolveGoRedirect(['flyer', 'ig'], redirects)).toBeNull()
    })

    it('misses an unknown key', () => {
        expect(resolveGoRedirect(['konrad', '1'], redirects)).toBeNull()
    })

    it.each(['constructor', '__proto__', 'tostring', 'toString', 'hasOwnProperty'])(
        'never reads %s from the object prototype',
        (key) => {
            expect(resolveGoRedirect([key], redirects)).toBeNull()
            expect(resolveGoRedirect([key])).toBeNull()
        }
    )

    it.each(['evil', 'protocol', 'backslash', 'encoded', 'loop', 'dotloop', 'bare'])(
        'refuses the %s destination at request time',
        (key) => {
            expect(resolveGoRedirect([key], redirects)).toBeNull()
        }
    )
})
