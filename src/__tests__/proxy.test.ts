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
