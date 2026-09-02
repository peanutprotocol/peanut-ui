import * as Sentry from '@sentry/nextjs'
import { fetchWithSentry, routeTag } from '../sentry.utils'

type ScopeSpy = { setFingerprint: jest.Mock; setTag: jest.Mock }

let lastScope: ScopeSpy

jest.mock('@sentry/nextjs', () => ({
    withScope: jest.fn(),
    captureMessage: jest.fn(),
    captureException: jest.fn(),
    addBreadcrumb: jest.fn(),
}))

jest.mock('@/utils/sentry-lazy', () => require('@sentry/nextjs'))

jest.mock('../connectivity', () => ({
    reportNetworkError: jest.fn(),
    hasRecentFailure: jest.fn(() => false),
}))

const abort = () => Object.assign(new Error('aborted'), { name: 'AbortError' })

const tagsSet = () => Object.fromEntries(lastScope.setTag.mock.calls)
const fingerprint = () => lastScope.setFingerprint.mock.calls[0]?.[0] as string[]

describe('timeout reporting — one issue, endpoint on a tag', () => {
    let infoSpy: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
        ;(Sentry.withScope as jest.Mock).mockImplementation((cb: (s: ScopeSpy) => void) => {
            lastScope = { setFingerprint: jest.fn(), setTag: jest.fn() }
            cb(lastScope)
        })
        global.fetch = jest.fn().mockRejectedValue(abort())
    })

    afterEach(() => infoSpy.mockRestore())

    const timeout = (url: string, init: RequestInit = {}) =>
        expect(fetchWithSentry(url, init)).rejects.toThrow(/taking too long/)

    /*
     * The regression this guards: interpolating the url into the message gave
     * every endpoint its own issue title, so a week of mobile timeouts arrived
     * as 30 single-event issues instead of one countable population.
     */
    it('groups every timeout onto one fingerprint, whatever the endpoint', async () => {
        await timeout('https://api.peanut.me/manteca/qr-payment/init', { method: 'POST' })
        const first = fingerprint()

        jest.clearAllMocks()
        await timeout('https://api.peanut.me/fx/card-markup?currency=ARS')

        expect(first).toEqual(['timeout'])
        expect(fingerprint()).toEqual(['timeout'])
    })

    it('keeps the url out of the title and in extra', async () => {
        await timeout('https://api.peanut.me/manteca/qr-payment/init', { method: 'POST' })

        const [error, hint] = (Sentry.captureException as jest.Mock).mock.calls[0]
        expect((error as Error).message).toBe('Request timed out')
        expect(hint.extra.url).toBe('https://api.peanut.me/manteca/qr-payment/init')
        expect(hint.extra.method).toBe('POST')
    })

    it('carries the endpoint, method and feature as tags', async () => {
        await timeout('https://api.peanut.me/manteca/qr-payment/init', { method: 'POST' })

        expect(tagsSet()).toEqual({
            route: '/manteca/qr-payment/init',
            'http.method': 'POST',
            feature: 'qr-pay',
        })
    })

    it('normalizes the route tag so one endpoint is one tag value', async () => {
        expect(routeTag('https://api.peanut.me/fx/card-markup?currency=ARS')).toBe('/fx/card-markup?currency={value}')
        // Staging and production share a route; `environment` already separates them.
        expect(routeTag('https://api.staging.peanut.me/charges')).toBe(routeTag('https://api.peanut.me/charges'))
    })
})

describe('silentTimeout — call sites that own a fallback', () => {
    let infoSpy: jest.SpyInstance

    beforeEach(() => {
        jest.clearAllMocks()
        infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
        ;(Sentry.withScope as jest.Mock).mockImplementation((cb: (s: ScopeSpy) => void) => {
            lastScope = { setFingerprint: jest.fn(), setTag: jest.fn() }
            cb(lastScope)
        })
    })

    afterEach(() => infoSpy.mockRestore())

    it('reports nothing but still throws, so the fallback runs', async () => {
        global.fetch = jest.fn().mockRejectedValue(abort())

        await expect(
            fetchWithSentry('https://api.peanut.me/fx/card-markup?currency=ARS', {
                silentTimeout: true,
            })
        ).rejects.toThrow(/taking too long/)

        expect(Sentry.captureException).not.toHaveBeenCalled()
    })

    it('leaves a breadcrumb so the timeout is still on the trail', async () => {
        global.fetch = jest.fn().mockRejectedValue(abort())

        await expect(
            fetchWithSentry('https://api.peanut.me/fx/card-markup?currency=ARS', {
                silentTimeout: true,
            })
        ).rejects.toThrow(/taking too long/)

        expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Request timed out (silent)',
                data: expect.objectContaining({ route: '/fx/card-markup?currency={value}' }),
            })
        )
    })

    // Scoped to the timeout on purpose: a 500 on this endpoint is not expected
    // and the caller's fallback is no reason to stop hearing about it.
    it('does not silence a non-2xx response', async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            status: 500,
            clone: () => ({ json: () => Promise.resolve({}), text: () => Promise.resolve('{}') }),
        } as unknown as Response)

        await fetchWithSentry('https://api.peanut.me/fx/card-markup?currency=ARS', { silentTimeout: true })

        expect(Sentry.captureMessage).toHaveBeenCalled()
    })
})
