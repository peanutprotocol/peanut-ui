/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15'

function get(path: string, cookies: Record<string, string> = {}, headers: Record<string, string> = {}) {
    const request = new NextRequest(new URL(`https://peanut.me${path}`), { headers })
    for (const [name, value] of Object.entries(cookies)) {
        request.cookies.set(name, value)
    }
    return proxy(request)
}

describe('proxy — locale redirect on /', () => {
    it('does not redirect a first-time visitor (no cookie)', () => {
        const response = get('/')
        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
    })

    it('does not redirect when the stored locale is the default', () => {
        expect(get('/', { 'app-locale': 'en' }).headers.get('location')).toBeNull()
    })

    it('redirects to the stored locale, accepting the app casing', () => {
        expect(get('/', { 'app-locale': 'es-419' }).headers.get('location')).toBe('https://peanut.me/es-419')
        expect(get('/', { 'app-locale': 'pt-BR' }).headers.get('location')).toBe('https://peanut.me/pt-br')
    })

    it('uses 307 so / stays the canonical English URL', () => {
        expect(get('/', { 'app-locale': 'es-419' }).status).toBe(307)
    })

    it('sets Vary on the redirect for both signals it reads', () => {
        expect(get('/', { 'app-locale': 'es-419' }).headers.get('vary')).toBe('Cookie, Accept-Language')
    })

    it('does not claim Vary on the pass-through response', () => {
        // Next rewrites Vary with its own RSC list after the proxy runs, so
        // setting it here would be a lie. Verified ineffective via next.config
        // headers() and vercel.json alike on a preview deploy. Safe because the
        // proxy runs ahead of the cache on every request to `/`.
        expect(get('/').headers.get('vary')).toBeNull()
    })

    it('coerces an unsupported stored tag rather than redirecting to a dead route', () => {
        expect(get('/', { 'app-locale': 'fr-FR' }).headers.get('location')).toBeNull()
        expect(get('/', { 'app-locale': 'es-ES' }).headers.get('location')).toBe('https://peanut.me/es-419')
    })

    it('sends a stored es-AR to the restored es-ar landing', () => {
        expect(get('/', { 'app-locale': 'es-AR' }).headers.get('location')).toBe('https://peanut.me/es-ar')
    })

    it('keeps the query string on the locale redirect — campaign/UTM params must survive', () => {
        const response = get('/?utm_source=x&utm_campaign=y', { 'app-locale': 'es-419' })
        expect(response.headers.get('location')).toBe('https://peanut.me/es-419?utm_source=x&utm_campaign=y')
    })

    it('lets a promo link reach the promo branch even when a locale cookie is set', () => {
        // The localized landings are not in the matcher, so if the locale
        // redirect ran first the promo branch could never fire.
        const response = get('/?promo=1&id=2', { 'app-locale': 'es-419' })
        expect(response.headers.get('location')).toContain('https://peanut.me/claim')
    })

    it('lets the signed-in redirect win — authenticated users go to the app, not marketing', () => {
        const response = get('/', { 'jwt-token': 'x', 'app-locale': 'es-419' })
        expect(response.headers.get('location')).toBe('https://peanut.me/home')
    })

    it('leaves non-root paths alone', () => {
        expect(get('/home', { 'app-locale': 'es-419' }).headers.get('location')).toBeNull()
    })
})

describe('proxy — Accept-Language preset on first visit', () => {
    it('sends a cookieless browser to its preferred locale and pre-sets the cookie', () => {
        const response = get('/', {}, { 'user-agent': BROWSER_UA, 'accept-language': 'es-AR,es;q=0.9,en;q=0.8' })
        expect(response.headers.get('location')).toBe('https://peanut.me/es-ar')
        expect(response.headers.get('set-cookie')).toContain('app-locale=es-AR')
    })

    it('honours q-ordering — an explicitly preferred English stays English', () => {
        const response = get('/', {}, { 'user-agent': BROWSER_UA, 'accept-language': 'en-GB,en;q=0.9,es;q=0.8' })
        expect(response.headers.get('location')).toBeNull()
    })

    it('maps a bare language subtag onto its regional default', () => {
        const response = get('/', {}, { 'user-agent': BROWSER_UA, 'accept-language': 'pt' })
        expect(response.headers.get('location')).toBe('https://peanut.me/pt-br')
    })

    it('never language-redirects a crawler', () => {
        const response = get(
            '/',
            {},
            { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'accept-language': 'es-419' }
        )
        expect(response.headers.get('location')).toBeNull()
    })

    it('treats a missing user-agent as a bot', () => {
        expect(get('/', {}, { 'accept-language': 'es-419' }).headers.get('location')).toBeNull()
    })

    it('lets the cookie beat the header — an explicit choice is never re-sniffed', () => {
        const response = get(
            '/',
            { 'app-locale': 'en' },
            { 'user-agent': BROWSER_UA, 'accept-language': 'es-AR,es;q=0.9' }
        )
        expect(response.headers.get('location')).toBeNull()
    })

    it('does not overwrite the stored cookie when redirecting from it', () => {
        const response = get('/', { 'app-locale': 'es-419' }, { 'user-agent': BROWSER_UA })
        expect(response.headers.get('location')).toBe('https://peanut.me/es-419')
        expect(response.headers.get('set-cookie')).toBeNull()
    })
})
