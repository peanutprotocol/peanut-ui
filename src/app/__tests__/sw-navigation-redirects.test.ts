/**
 * @jest-environment node
 */
import type { HandlerWillRespondCallbackParam } from 'serwist'
import { navigationRedirectPlugin } from '../sw-navigation-redirects'

const respond = navigationRedirectPlugin.handlerWillRespond!
const event = {} as HandlerWillRespondCallbackParam['event']

// A Request's mode can't be set to 'navigate' from script, and `redirected`
// and `url` are read-only on a real Response — so both are shaped by hand.
const request = (mode: RequestMode) => ({ mode, url: 'https://peanut.me/en/help/?fromNativeApp=1' }) as Request
const redirected = (url: string) => {
    const response = new Response('<html>help</html>', { status: 200 })
    Object.defineProperty(response, 'redirected', { value: true })
    Object.defineProperty(response, 'url', { value: url })
    return response
}

describe('service-worker navigation redirects', () => {
    it('answers a navigation that followed a redirect with the redirect itself', async () => {
        const response = await respond({
            event,
            request: request('navigate'),
            response: redirected('https://peanut.me/en/help?fromNativeApp=1'),
        })
        expect(response.status).toBe(302)
        expect(response.headers.get('Location')).toBe('https://peanut.me/en/help?fromNativeApp=1')
        expect(response.redirected).toBe(false)
    })

    it('serves a navigation that did not redirect as-is', async () => {
        const page = new Response('<html>help</html>', { status: 200 })
        expect(await respond({ event, request: request('navigate'), response: page })).toBe(page)
    })

    it('leaves redirected subresource fetches alone — only navigations are refused', async () => {
        const script = redirected('https://peanut.me/_next/static/chunk.js')
        expect(await respond({ event, request: request('cors'), response: script })).toBe(script)
    })
})
