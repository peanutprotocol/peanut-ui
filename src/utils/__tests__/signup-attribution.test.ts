import publicAttributionPaths from '@/constants/signup-attribution-paths.generated.json'
import { SUPPORTED_LOCALES } from '@/i18n/types'
import { LEGAL_POLICIES } from '@/constants/legal-policies'
import { saveToCookie } from '../cookie-url.utils'
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
    SIGNUP_ATTRIBUTION_COOKIE,
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
    it('preserves every published sitemap landing in the registration payload', () => {
        for (const path of publicAttributionPaths) {
            clearAttributionCookie()
            window.history.replaceState({}, '', path)
            Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://www.google.com/' })

            const context = captureSignupAttribution({ includeDocumentReferrer: true })
            expect(context?.firstTouch).toMatchObject({ path, referrerHost: 'www.google.com' })
            expect(parseSignupAttribution(buildSignupAttributionHeader())?.firstTouch.path).toBe(path)
            const isHomepage = path === '/' || SUPPORTED_LOCALES.some((locale) => path === `/${locale}`)
            const isPolicy = LEGAL_POLICIES.some(({ slug }) => path.endsWith(`/${slug}`))
            expect(context?.firstContentTouch?.path).toBe(
                isHomepage || isPolicy || path === '/careers' ? undefined : path
            )
        }
    })

    it.each([
        '/alice',
        '/en/alice',
        '/en/profile',
        '/es-419/claim/secret',
        '/pt-br/withdraw',
        '/withdraw/to-bank',
        '/send/alice',
        '/request/alice',
        '/pay/550e8400-e29b-41d4-a716-446655440000',
        '/en/deposit/from-550e8400-e29b-41d4-a716-446655440000',
        '/en/deposit/from-0x0000000000000000000000000000000000000001',
        '/en/blog/alice@example.com',
        '/en/blog/alice%40example.com',
        '/en/blog/alice',
        '/zz/argentina',
        '/en/receive-money-from/united-states/private',
    ])('does not capture a private, identifier-bearing or nonexistent route: %s', (path) => {
        window.history.replaceState({}, '', path)
        const context = captureSignupAttribution()
        expect(context?.firstTouch.path).toBeUndefined()
        expect(context?.firstContentTouch).toBeUndefined()
    })

    it('keeps the first country article after later content and signup navigation', () => {
        window.history.replaceState({}, '', '/en/argentina?email=private%40example.com#customer')
        const first = captureSignupAttribution()
        window.history.replaceState({}, '', '/en/pay-with/pix')
        captureSignupAttribution()
        window.history.replaceState({}, '', '/signup')
        const registration = parseSignupAttribution(buildSignupAttributionHeader())

        expect(first?.firstTouch.path).toBe('/en/argentina')
        expect(registration?.journeyId).toBe(first?.journeyId)
        expect(registration?.firstContentTouch).toEqual(first?.firstContentTouch)
        expect(registration?.firstContentTouch?.path).toBe('/en/argentina')
        expect(JSON.stringify(registration)).not.toContain('private')
    })

    it.each(['/careers', '/en/privacy', '/en/terms', '/en/card-terms-us'])(
        'does not let an administrative page take the first content touch: %s',
        (path) => {
            window.history.replaceState({}, '', path)
            const first = captureSignupAttribution()
            expect(first?.firstTouch.path).toBe(path)
            expect(first?.firstContentTouch).toBeUndefined()
            window.history.replaceState({}, '', '/en/argentina')
            const content = captureSignupAttribution()
            expect(content?.firstTouch).toEqual(first?.firstTouch)
            expect(content?.firstContentTouch?.path).toBe('/en/argentina')
        }
    )

    it('records delayed content discovery without replacing the initial home touch', () => {
        window.history.replaceState({}, '', '/es-419')
        const first = captureSignupAttribution()
        expect(first?.firstContentTouch).toBeUndefined()
        window.history.replaceState({}, '', '/es-419/use-cases/remote-workers')
        const content = captureSignupAttribution()
        expect(content?.firstTouch).toEqual(first?.firstTouch)
        expect(content?.firstContentTouch?.path).toBe('/es-419/use-cases/remote-workers')
    })

    it('records a real locale fallback article even though its canonical URL uses another locale', () => {
        window.history.replaceState({}, '', '/es-ar/blog/stablecoin-balance-visa-merchants')
        const context = captureSignupAttribution()
        expect(context?.firstTouch.path).toBe('/es-ar/blog/stablecoin-balance-visa-merchants')
        expect(context?.firstContentTouch?.path).toBe('/es-ar/blog/stablecoin-balance-visa-merchants')
    })

    it.each([
        '/en/deposit/from-future-exchange',
        '/pt-br/withdraw/future-network',
        '/es-419/stories/new-story',
        '/en/use-cases/new-use-case',
        '/en/compare/peanut-vs-future-provider',
        '/en/send-money-from/future-origin/to/future-destination',
    ])('reads a public article absent from an older native inventory: %s', (path) => {
        window.history.replaceState({}, '', '/en/argentina')
        const context = captureSignupAttribution()!
        const touch = { ...context.firstTouch, path }
        const restored = parseSignupAttribution(
            JSON.stringify({ ...context, firstTouch: touch, firstContentTouch: touch })
        )
        expect(restored?.journeyId).toBe(context.journeyId)
        expect(restored?.firstTouch.path).toBe(path)
        expect(restored?.firstContentTouch?.path).toBe(path)

        clearAttributionCookie()
        window.history.replaceState({}, '', path)
        expect(captureSignupAttribution()?.firstTouch.path).toBeUndefined()
    })

    it.each([
        '/en/new-country-hub',
        '/en/profile',
        '/en/deposit/from-alice@example.com',
        '/en/deposit/from-alice%40example.com',
        '/en/deposit/from-550e8400-e29b-41d4-a716-446655440000',
        '/en/withdraw/0x0000000000000000000000000000000000000001',
        '/en/withdraw/to-bank/private',
        '/zz/deposit/from-coinbase',
    ])('drops an unknown or sensitive stored path without losing the known journey: %s', (path) => {
        window.history.replaceState({}, '', '/en/argentina?utm_source=newsletter')
        const context = captureSignupAttribution()!
        const touch = { ...context.firstTouch, path }
        const restored = parseSignupAttribution(
            JSON.stringify({ ...context, firstTouch: touch, firstContentTouch: touch })
        )
        expect(restored?.journeyId).toBe(context.journeyId)
        expect(restored?.firstTouch.utmSource).toBe('newsletter')
        expect(restored?.firstTouch.path).toBeUndefined()
        expect(restored?.firstContentTouch).toBeUndefined()
        expect(JSON.stringify(restored)).not.toContain(path)
    })

    it('still rejects malformed path types and unrecognized touch fields', () => {
        window.history.replaceState({}, '', '/en/argentina')
        const context = captureSignupAttribution()!
        for (const touch of [
            { ...context.firstTouch, path: { private: 'value' } },
            { ...context.firstTouch, privateField: 'value' },
        ]) {
            expect(parseSignupAttribution(JSON.stringify({ ...context, firstTouch: touch }))).toBeNull()
        }
    })

    it('retains a previously captured article after it leaves the sitemap', () => {
        const touch = {
            occurredAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
            path: '/en/blog/retired-article',
            utmSource: 'newsletter',
        }
        saveToCookie(SIGNUP_ATTRIBUTION_COOKIE, {
            schemaVersion: '1',
            journeyId: '33333333-3333-4333-8333-333333333333',
            platform: 'web',
            analyticsState: 'enabled',
            captureMethod: 'browser',
            firstTouch: touch,
            firstContentTouch: touch,
        })
        window.history.replaceState({}, '', '/en/argentina')
        const context = captureSignupAttribution()
        expect(context?.firstTouch).toEqual(touch)
        expect(context?.firstContentTouch).toEqual(touch)
        expect(parseSignupAttribution(buildSignupAttributionHeader())?.firstContentTouch).toEqual(touch)
    })

    it('carries a deposit article through deferred native restore and a lost cookie', async () => {
        window.history.replaceState({}, '', '/en/deposit/from-usd-account')
        const web = captureSignupAttribution()
        process.env.NEXT_PUBLIC_CAPACITOR_BUILD = 'true'
        window.history.replaceState({}, '', '/setup')
        const deferred = restoreSignupAttribution(parseSignupAttribution(serializeSignupAttribution(web))!)
        const registration = await ensureSignupAttributionForRegistration()
        expect(registration?.firstContentTouch?.path).toBe('/en/deposit/from-usd-account')
        expect(registration?.journeyId).toBe(web?.journeyId)
        expect(registration?.captureMethod).toBe('deferred_link')

        clearAttributionCookie()
        mockPreferencesGet.mockResolvedValue({ value: JSON.stringify(deferred) })
        const recovered = await ensureSignupAttributionForRegistration()
        expect(recovered?.firstTouch).toEqual(web?.firstTouch)
        expect(recovered?.firstContentTouch).toEqual(web?.firstContentTouch)
        expect(recovered?.captureMethod).toBe('deferred_link')
    })

    it('keeps first touch stable while updating the last source touch', () => {
        window.history.replaceState(
            {},
            '',
            '/en/blog/earn-with-peanut-3min-setup?utm_source=creator&utm_medium=social&utm_campaign=summer'
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
                path: '/en/blog/earn-with-peanut-3min-setup',
            },
            firstContentTouch: { path: '/en/blog/earn-with-peanut-3min-setup' },
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
        window.history.replaceState({}, '', '/en/blog/earn-with-peanut-3min-setup')
        Object.defineProperty(document, 'referrer', {
            configurable: true,
            value: 'https://example.com/article',
        })

        const first = captureSignupAttribution({ includeDocumentReferrer: true })
        window.history.replaceState({}, '', '/signup')
        const second = captureSignupAttribution()

        expect(first?.lastTouch).toMatchObject({
            referrerHost: 'example.com',
            path: '/en/blog/earn-with-peanut-3min-setup',
        })
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

        expect(`${SIGNUP_ATTRIBUTION_COOKIE}=${encodeURIComponent(JSON.stringify(context))}`.length).toBeGreaterThan(
            4096
        )
        const serialized = serializeSignupAttribution(context)
        expect(serialized).not.toBeNull()
        expect(serialized!.length).toBeLessThanOrEqual(4096)
        expect(parseSignupAttribution(serialized)).not.toBeNull()
        expect(parseSignupAttribution(JSON.stringify({ ...context, unexpected: 'field' }))).toBeNull()
        expect(parseSignupAttribution(JSON.stringify({ ...context, unexpected: 'x'.repeat(5000) }))).toBeNull()
    })

    it('bounds the percent-encoded cookie while preserving the first campaign touch', () => {
        const occurredAt = new Date().toISOString()
        const maxSpacedTag = `x${' '.repeat(126)}x`
        const slashHeavyPath = `/blog/${'a/'.repeat(250)}`
        const touch = {
            occurredAt,
            utmSource: maxSpacedTag,
            utmMedium: maxSpacedTag,
            utmCampaign: maxSpacedTag,
            utmContent: maxSpacedTag,
            referrerHost: `${'x'.repeat(120)}.example`,
            path: slashHeavyPath,
        }
        const context = {
            schemaVersion: '1' as const,
            journeyId: '33333333-3333-4333-8333-333333333333',
            platform: 'web' as const,
            analyticsState: 'enabled' as const,
            captureMethod: 'browser' as const,
            firstTouch: touch,
            firstContentTouch: touch,
            lastTouch: touch,
        }

        const serialized = serializeSignupAttribution(context)
        expect(serialized).not.toBeNull()
        expect(`${SIGNUP_ATTRIBUTION_COOKIE}=${encodeURIComponent(serialized!)}`.length).toBeLessThanOrEqual(4096)
        expect(parseSignupAttribution(serialized)?.firstTouch).toMatchObject({
            utmSource: maxSpacedTag,
            utmCampaign: maxSpacedTag,
            path: slashHeavyPath,
        })
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
        expect(await hasPendingSignupAttribution('user-a')).toBe(false)
        await markSignupAttributionPending('user-a')
        expect(await hasPendingSignupAttribution('user-a')).toBe(true)
        expect(await hasPendingSignupAttribution('user-b')).toBe(false)
        await clearPendingSignupAttribution('user-b')
        expect(await hasPendingSignupAttribution('user-a')).toBe(true)
        await clearPendingSignupAttribution('user-a')
        expect(await hasPendingSignupAttribution('user-a')).toBe(false)
    })
})
