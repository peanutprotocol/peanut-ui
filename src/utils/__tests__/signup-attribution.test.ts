import {
    buildSignupAttributionHeader,
    captureSignupAttribution,
    clearPendingSignupAttribution,
    hasPendingSignupAttribution,
    markSignupAttributionPending,
    parseSignupAttribution,
    readSignupAttribution,
    restoreSignupAttribution,
    signupAttributionPosthogProperties,
} from '../signup-attribution'

const clearAttributionCookie = () => {
    document.cookie = 'signupAttribution=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

beforeEach(() => {
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    clearPendingSignupAttribution()
    clearAttributionCookie()
    window.history.replaceState({}, '', '/')
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
})

describe('signup attribution context', () => {
    it('keeps first touch stable while updating the last source touch', () => {
        window.history.replaceState(
            {},
            '',
            '/blog/creator-guide?utm_source=creator&utm_medium=social&utm_campaign=summer'
        )
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://example.com/article',
        })

        const first = captureSignupAttribution()
        expect(first).toMatchObject({
            platform: 'web',
            captureMethod: 'browser',
            firstTouch: {
                utmSource: 'creator',
                utmMedium: 'social',
                utmCampaign: 'summer',
                referrerHost: 'example.com',
                path: '/blog/creator-guide',
            },
            firstContentTouch: { path: '/blog/creator-guide' },
        })

        window.history.replaceState({}, '', '/signup?utm_source=paid&utm_medium=cpc&utm_campaign=retargeting')
        const second = captureSignupAttribution()

        expect(second?.journeyId).toBe(first?.journeyId)
        expect(second?.firstTouch).toEqual(first?.firstTouch)
        expect(second?.firstContentTouch).toEqual(first?.firstContentTouch)
        expect(second?.lastTouch).toMatchObject({
            utmSource: 'paid',
            utmMedium: 'cpc',
            utmCampaign: 'retargeting',
            path: '/signup',
        })
    })

    it('round-trips the context through the registration header and preserves its journey id', () => {
        window.history.replaceState({}, '', '/?utm_source=newsletter&utm_medium=email')
        const captured = captureSignupAttribution()
        expect(captured).not.toBeNull()

        const parsed = parseSignupAttribution(buildSignupAttributionHeader())
        expect(parsed).toEqual(readSignupAttribution())
        expect(parsed?.journeyId).toBe(captured?.journeyId)
        expect(signupAttributionPosthogProperties(parsed)).toEqual({
            signup_journey_id: captured?.journeyId,
            signup_platform: 'web',
            signup_attribution_capture_method: 'browser',
        })
    })

    it('marks deferred-link attribution and retains it for native registration', () => {
        window.history.replaceState({}, '', '/?utm_source=creator&utm_campaign=summer')
        const captured = captureSignupAttribution()
        expect(captured).not.toBeNull()

        const restored = restoreSignupAttribution(captured!)
        expect(restored).toMatchObject({
            journeyId: captured?.journeyId,
            captureMethod: 'deferred_link',
        })
        expect(readSignupAttribution()).toEqual(restored)
    })

    it('rejects identifier-shaped campaign values at capture time', () => {
        window.history.replaceState(
            {},
            '',
            '/?utm_source=550e8400-e29b-41d4-a716-446655440000&utm_campaign=wallet%40example.com'
        )
        const captured = captureSignupAttribution()
        expect(captured?.firstTouch).toMatchObject({ path: '/' })
        expect(captured?.firstTouch.utmSource).toBeUndefined()
        expect(captured?.firstTouch.utmCampaign).toBeUndefined()
    })

    it('limits authenticated finalization retries to a completed signup marker', async () => {
        expect(await hasPendingSignupAttribution()).toBe(false)
        markSignupAttributionPending()
        expect(await hasPendingSignupAttribution()).toBe(true)
        clearPendingSignupAttribution()
        expect(await hasPendingSignupAttribution()).toBe(false)
    })
})
