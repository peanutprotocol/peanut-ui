/** @jest-environment node */
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

function runProxy(path: string) {
    return proxy(new NextRequest(`https://peanut.me${path}`))
}

describe('app-entry gateway', () => {
    it('sends a browser QR scan to the smart-store page and preserves its handoff', () => {
        const response = runProxy('/home?app_entry=1&pnutdl=1&badgeCampaign=door&dest=%2Fcard')

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('https://peanut.me/app?pnutdl=1&badgeCampaign=door&dest=%2Fcard')
    })

    it('sends a browser that opened a registered marketing QR to the /q handoff with its campaign', () => {
        const response = runProxy('/home?mqr=home-hero-en&s=twitter&m=social&c=qr-test&o=current_url')

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe(
            'https://peanut.me/q/home-hero-en?s=twitter&m=social&c=qr-test&o=current_url'
        )
    })

    it('leaves /home alone for an unregistered marketing QR id', () => {
        const response = runProxy('/home?mqr=send-hero-en')

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
    })

    it('does not redirect ordinary /home navigation', () => {
        const response = runProxy('/home?tab=activity')

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
    })
})

describe('retired creator links', () => {
    it.each([
        ['/app?code=alice', '/invite?code=alice'],
        ['/app?code=Alice', '/invite?code=alice'],
        ['/app/?code=alice', '/invite?code=alice'],
        ['/app/?tl=alice&acq_invite=alice', '/invite?code=alice'],
        ['/home?app_entry=1&code=alice', '/invite?code=alice'],
        ['/app?tl=alice&acq_invite=alice', '/invite?code=alice'],
        // What the removed "Open Peanut" button reloaded in a browser.
        [
            '/home?app_entry=1&pnutdl=1&acq_invite=alice&badge_campaign=nita&tl=alice&at=x&tl_seen=1',
            '/invite?code=alice',
        ],
        ['/app?pnutdl=1&acq_invite=alice&tl=alice&tl_seen=1', '/invite?code=alice'],
    ])('sends a browser from %s to the creator invite page', (path, target) => {
        const response = runProxy(path)

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe(`https://peanut.me${target}`)
    })

    it.each([
        '/app',
        '/app?pnutdl=1&invite=ABC123&dest=%2Fsend',
        '/app?utm_source=x&utm_campaign=launch',
        '/app?code=al%2Fice',
        '/app?tl=al-ice&acq_invite=alice',
        '/app?code=https%3A%2F%2Fevil.example',
    ])('leaves the store page alone for %s', (path) => {
        const response = runProxy(path)

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
    })

    it('leaves a /home visit without the app-entry marker alone', () => {
        const response = runProxy('/home?tl=alice&acq_invite=alice')

        expect(response.status).toBe(200)
        expect(response.headers.get('location')).toBeNull()
    })
})

describe('API cache policy', () => {
    it('lets the exact exchange-rate route preserve its route-owned cache headers', () => {
        const response = runProxy('/api/exchange-rate?from=PLN&to=EUR')

        expect(response.headers.get('Cache-Control')).toBeNull()
        expect(response.headers.get('Pragma')).toBeNull()
        expect(response.headers.get('Expires')).toBeNull()
        expect(response.headers.get('Surrogate-Control')).toBeNull()
    })

    it.each(['/api/rooms', '/api/exchange-rate/', '/api/exchange-rate-history'])(
        'keeps no-store on every other API path: %s',
        (path) => {
            const response = runProxy(path)

            expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate')
            expect(response.headers.get('Pragma')).toBe('no-cache')
            expect(response.headers.get('Expires')).toBe('0')
            expect(response.headers.get('Surrogate-Control')).toBe('no-store')
        }
    )
})
