/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

function get(path: string, cookies: Record<string, string> = {}) {
    const request = new NextRequest(new URL(`https://peanut.me${path}`))
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

    it('always sets Vary: Cookie on / so a CDN cannot leak one visitor cache to all', () => {
        expect(get('/').headers.get('vary')).toBe('Cookie')
        expect(get('/', { 'app-locale': 'es-419' }).headers.get('vary')).toBe('Cookie')
    })

    it('coerces an unsupported stored tag rather than redirecting to a dead route', () => {
        expect(get('/', { 'app-locale': 'fr-FR' }).headers.get('location')).toBeNull()
        expect(get('/', { 'app-locale': 'es-AR' }).headers.get('location')).toBe('https://peanut.me/es-419')
    })

    it('lets the signed-in redirect win — authenticated users go to the app, not marketing', () => {
        const response = get('/', { 'jwt-token': 'x', 'app-locale': 'es-419' })
        expect(response.headers.get('location')).toBe('https://peanut.me/home')
    })

    it('leaves non-root paths alone', () => {
        expect(get('/home', { 'app-locale': 'es-419' }).headers.get('location')).toBeNull()
    })
})
