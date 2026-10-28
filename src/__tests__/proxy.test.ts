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
        const response = runProxy(
            '/home?app_entry=1&marketing_qr=home-hero-en&s=twitter&m=social&c=qr-test&o=current_url'
        )

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe(
            'https://peanut.me/q/home-hero-en?s=twitter&m=social&c=qr-test&o=current_url'
        )
    })

    it('treats an unregistered marketing QR id as a plain app entry', () => {
        const response = runProxy('/home?app_entry=1&marketing_qr=send-hero-en')

        expect(response.status).toBe(307)
        expect(response.headers.get('location')).toBe('https://peanut.me/app?marketing_qr=send-hero-en')
    })

    it('does not redirect ordinary /home navigation', () => {
        const response = runProxy('/home?tab=activity')

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
