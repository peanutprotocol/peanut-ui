import { parseQrRedirectUrl } from '../qr-redirect.utils'
import { sanitizeRedirectURL } from '../cookie-url.utils'

const unsafeUrls = [
    'https://peanut.me.evil.example/phish',
    'https://evilpeanut.me/phish',
    'https://localhost.evil.example/phish',
    'http://peanut.me/phish',
    'javascript://peanut.me/%0Aalert(1)',
    'data://peanut.me/payload',
    'https://user:secret@peanut.me/phish',
    'https://peanut.me:8443/phish',
    'https://peanut.me/.//evil.example',
    'https://peanut.me/%2e//evil.example',
    'https://peanut.me/a/..//evil.example',
    'https://peanut.me/\\evil.example',
    'https://peanut.me/%2f%2fevil.example',
    '//evil.example',
]

describe('QR redirect destinations', () => {
    it.each(unsafeUrls)('rejects %s', (url) => {
        expect(parseQrRedirectUrl(url)).toBeNull()
    })
    it.each(['peanut.me', 'www.peanut.me', 'staging.peanut.me', 'dev.peanut.me'])(
        'keeps HTTPS invite destinations on %s',
        (host) => {
            const target = `https://${host}/alice/i/123?code=ALICE#invite`
            expect(parseQrRedirectUrl(target)?.href).toBe(target)
        }
    )
    it('accepts an explicitly configured HTTPS preview origin', () => {
        const previous = process.env.NEXT_PUBLIC_BASE_URL
        process.env.NEXT_PUBLIC_BASE_URL = 'https://preview.example'
        try {
            expect(parseQrRedirectUrl('https://preview.example/alice/i/123')?.hostname).toBe('preview.example')
            expect(parseQrRedirectUrl('https://preview.example.evil/alice/i/123')).toBeNull()
        } finally {
            if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
            else process.env.NEXT_PUBLIC_BASE_URL = previous
        }
    })
})

describe('same-origin redirect serialization', () => {
    it.each([
        '/.//evil.example',
        '/%2e//evil.example',
        '/.%2e//evil.example',
        '/a/..//evil.example',
        '/\\evil.example',
        '/%2f%2fevil.example',
        `${window.location.origin}//evil.example`,
        'javascript:alert(1)',
        '//evil.example',
    ])('does not return a router path for %s', (target) => {
        expect(sanitizeRedirectURL(target)).toBeNull()
    })
    it.each(['/alice/i/123?code=ALICE#invite', '/home', '/profile/exchange-rate?from=USD&to=EUR'])(
        'preserves internal path %s',
        (path) => {
            expect(sanitizeRedirectURL(path)).toBe(path)
            expect(sanitizeRedirectURL(`${window.location.origin}${path}`)).toBe(path)
        }
    )
})
