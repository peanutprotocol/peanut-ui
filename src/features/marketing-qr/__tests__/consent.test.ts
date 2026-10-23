import { marketingQrAnalyticsAllowed } from '../consent'
import { ConsentManager } from 'posthog-js/lib/src/consent'

const key = '__ph_opt_in_out_test-key'
beforeEach(() => {
    localStorage.clear()
    document.cookie = `${key}=; Max-Age=0; path=/`
    Object.defineProperty(navigator, 'doNotTrack', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: undefined })
})

it('uses the installed PostHog default key without writing an identity or preference', () => {
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(true)
    expect(localStorage.length).toBe(0)
    localStorage.setItem(key, '0')
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
    localStorage.setItem(key, '1')
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(true)
    expect(localStorage.length).toBe(1)
})

it.each(['localStorage', 'cookie'])('reads preferences written by the installed SDK using %s', (persistenceType) => {
    // The real SDK consent manager only uses this config; no SDK initialization,
    // network, feature flags or capture occur in this compatibility check.
    const manager = new ConsentManager({
        config: {
            token: 'test-key',
            opt_out_capturing_persistence_type: persistenceType,
            cookie_expiration: 365,
            cross_subdomain_cookie: false,
            secure_cookie: false,
        },
    } as unknown as ConstructorParameters<typeof ConsentManager>[0])
    manager.optInOut(false)
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
    manager.optInOut(true)
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(true)
    manager.reset()
})

it.each(['0', 'false', 'no', '', 'garbage', '"1"'])('denies opt-out or malformed storage %s', (value) => {
    localStorage.setItem(key, value)
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
})

it('lets either cookie or localStorage denial win', () => {
    localStorage.setItem(key, '1')
    document.cookie = `${key}=0; path=/`
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
    document.cookie = `${key}=1; path=/`
    localStorage.setItem(key, '0')
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
})

it('denies unreadable storage, absent configuration, DNT and GPC', () => {
    const spy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked')
    })
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
    spy.mockRestore()
    expect(marketingQrAnalyticsAllowed('')).toBe(false)
    Object.defineProperty(navigator, 'doNotTrack', { value: '1', configurable: true })
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
    Object.defineProperty(navigator, 'doNotTrack', { value: undefined, configurable: true })
    Object.defineProperty(navigator, 'globalPrivacyControl', { value: true, configurable: true })
    expect(marketingQrAnalyticsAllowed('test-key')).toBe(false)
})
