import {
    buildSignupAttributionHeader,
    captureSignupAttribution,
    clearSignupAttribution,
    clearPendingSignupAttribution,
    ensureSignupAttributionForRegistration,
    hasPendingSignupAttribution,
    markSignupAttributionPending,
    parseSignupAttribution,
    readSignupAttribution,
    readSignupAttributionAsync,
    restoreSignupAttribution,
    serializeSignupAttribution,
    signupAttributionPosthogProperties,
} from '../signup-attribution'

const mockPreferencesGet = jest.fn()
const mockPreferencesSet = jest.fn()
const mockPreferencesRemove = jest.fn()

jest.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: (...args: unknown[]) => mockPreferencesGet(...args),
        set: (...args: unknown[]) => mockPreferencesSet(...args),
        remove: (...args: unknown[]) => mockPreferencesRemove(...args),
    },
}))

const clearAttributionCookie = () => {
    document.cookie = 'signupAttribution=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
}

beforeEach(async () => {
    process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'false'
    await clearPendingSignupAttribution()
    clearAttributionCookie()
    window.history.replaceState({}, '', '/')
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' })
    mockPreferencesGet.mockResolvedValue({ value: null })
    mockPreferencesSet.mockResolvedValue(undefined)
    mockPreferencesRemove.mockResolvedValue(undefined)
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

        const first = captureSignupAttribution({ includeDocumentReferrer: true })
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
        expect(second?.lastTouch?.referrerHost).toBeUndefined()
    })

    it('does not replay the document referrer on an untagged SPA navigation', () => {
        window.history.replaceState({}, '', '/blog/creator-guide')
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://example.com/article',
        })

        const first = captureSignupAttribution({ includeDocumentReferrer: true })
        window.history.replaceState({}, '', '/signup')
        const second = captureSignupAttribution()

        expect(first?.lastTouch).toMatchObject({ referrerHost: 'example.com', path: '/blog/creator-guide' })
        expect(second?.lastTouch).toEqual(first?.lastTouch)
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

    it('creates and persists a journey for a direct native registration', async () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        window.history.replaceState({}, '', '/setup')

        const context = await ensureSignupAttributionForRegistration()

        expect(context).toMatchObject({ platform: 'android', captureMethod: 'browser', firstTouch: { path: '/setup' } })
        expect(mockPreferencesSet).toHaveBeenCalledWith({
            key: 'signup-attribution',
            value: JSON.stringify(context),
        })
    })

    it('recovers a Preferences-only journey after the native WebView cookie is lost', async () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        const context = {
            schemaVersion: '1' as const,
            journeyId: '33333333-3333-4333-8333-333333333333',
            platform: 'android' as const,
            analyticsState: 'enabled' as const,
            captureMethod: 'browser' as const,
            firstTouch: { occurredAt: new Date().toISOString(), path: '/setup' },
        }
        mockPreferencesGet.mockResolvedValue({ value: JSON.stringify(context) })

        expect(readSignupAttribution()).toBeNull()
        await expect(readSignupAttributionAsync()).resolves.toEqual(context)
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

    it('rejects extra fields and bounds canonical uploads', () => {
        const occurredAt = new Date().toISOString()
        const maxTag = 'x'.repeat(128)
        const touch = {
            occurredAt,
            utmSource: maxTag,
            utmMedium: maxTag,
            utmCampaign: maxTag,
            utmContent: maxTag,
            referrerHost: `${maxTag}.example`,
            path: `/blog/${'x'.repeat(500)}`,
        }
        const context = {
            schemaVersion: '1' as const,
            journeyId: '33333333-3333-4333-8333-333333333333',
            platform: 'android' as const,
            analyticsState: 'enabled' as const,
            captureMethod: 'deferred_link' as const,
            firstTouch: touch,
            firstContentTouch: touch,
            lastTouch: touch,
        }

        const serialized = serializeSignupAttribution(context)
        expect(serialized).not.toBeNull()
        expect(serialized!.length).toBeLessThanOrEqual(4096)
        expect(parseSignupAttribution(serialized)).not.toBeNull()
        expect(parseSignupAttribution(JSON.stringify({ ...context, unexpected: 'field' }))).toBeNull()
        expect(parseSignupAttribution(JSON.stringify({ ...context, unexpected: 'x'.repeat(5000) }))).toBeNull()
    })

    it('awaits both native attribution removals at an account boundary', async () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'

        await clearSignupAttribution()

        expect(mockPreferencesRemove).toHaveBeenCalledWith({ key: 'signup-attribution-pending' })
        expect(mockPreferencesRemove).toHaveBeenCalledWith({ key: 'signup-attribution' })
    })

    it('removes an invalid native payload so it cannot retry forever', async () => {
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        mockPreferencesGet.mockResolvedValue({ value: JSON.stringify({ unexpected: 'legacy-payload' }) })

        await expect(readSignupAttributionAsync()).resolves.toBeNull()

        expect(mockPreferencesRemove).toHaveBeenCalledWith({ key: 'signup-attribution-pending' })
        expect(mockPreferencesRemove).toHaveBeenCalledWith({ key: 'signup-attribution' })
    })

    it('limits authenticated finalization retries to a completed signup marker', async () => {
        expect(await hasPendingSignupAttribution()).toBe(false)
        markSignupAttributionPending()
        expect(await hasPendingSignupAttribution()).toBe(true)
        await clearPendingSignupAttribution()
        expect(await hasPendingSignupAttribution()).toBe(false)
    })
})
