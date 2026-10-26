import { renderHook } from '@testing-library/react'
import { useMarketingQrUrl } from '../useMarketingQrUrl'
import { readSignupAttribution } from '@/utils/signup-attribution'
import { marketingQrAnalyticsAllowed } from '../consent'
import type { MarketingQrContext } from '../contract'

jest.mock('@/utils/signup-attribution', () => ({ readSignupAttribution: jest.fn() }))
jest.mock('../consent', () => ({ marketingQrAnalyticsAllowed: jest.fn(() => true) }))

const context: MarketingQrContext = { page: 'home', placement: 'hero', locale: 'en' }
const originalGate = process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING

beforeEach(() => {
    jest.clearAllMocks()
    process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = 'true'
    jest.mocked(marketingQrAnalyticsAllowed).mockReturnValue(true)
    jest.mocked(readSignupAttribution).mockReset()
    window.history.replaceState({}, '', '/')
})

afterAll(() => {
    if (originalGate === undefined) delete process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
    else process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING = originalGate
})

it('carries campaign labels without identifiers or unrelated query parameters', () => {
    window.history.replaceState(
        {},
        '',
        '/?utm_source=google&utm_medium=cpc&utm_campaign=accounts-launch&utm_content=hero-a&gclid=click-secret&code=someone&wid=identity'
    )
    const { result } = renderHook(() => useMarketingQrUrl({ origin: 'https://peanut.me', context }))
    const url = new URL(result.current!)
    expect(url.pathname).toBe('/q/home-hero-en')
    expect(Object.fromEntries(url.searchParams)).toEqual({
        s: 'google',
        m: 'cpc',
        c: 'accounts-launch',
        n: 'hero-a',
        o: 'current_url',
    })
})

it('does not read saved attribution when analytics is denied', () => {
    jest.mocked(marketingQrAnalyticsAllowed).mockReturnValue(false)
    window.history.replaceState({}, '', '/?utm_source=google&utm_medium=cpc&utm_campaign=accounts-launch')
    const { result } = renderHook(() => useMarketingQrUrl({ origin: 'https://peanut.me', context }))
    expect(result.current).toBe('https://peanut.me/q/home-hero-en')
    expect(readSignupAttribution).not.toHaveBeenCalled()
})

it('never reads browser attribution or replaces a QR when its caller is ineligible', () => {
    const { result } = renderHook(() => useMarketingQrUrl({ origin: 'https://peanut.me', context, enabled: false }))
    expect(result.current).toBeNull()
    expect(readSignupAttribution).not.toHaveBeenCalled()
    expect(marketingQrAnalyticsAllowed).not.toHaveBeenCalled()
})

it('keeps the rollout disabled by default', () => {
    delete process.env.NEXT_PUBLIC_MARKETING_QR_TRACKING
    const { result } = renderHook(() => useMarketingQrUrl({ origin: 'https://peanut.me', context }))
    expect(result.current).toBeNull()
    expect(readSignupAttribution).not.toHaveBeenCalled()
})

it.each([{ utmSource: 'unknown-source', utmMedium: 'cpc', utmCampaign: 'newest' }, { utmSource: 'instagram' }])(
    'chooses a complete valid older campaign without mixing the newest fields: %j',
    (last) => {
        const occurredAt = new Date().toISOString()
        jest.mocked(readSignupAttribution).mockReturnValue({
            schemaVersion: '1',
            journeyId: '8c7ea260-78f2-4e88-b83a-b423c5779854',
            platform: 'web',
            analyticsState: 'enabled',
            captureMethod: 'browser',
            firstTouch: { occurredAt, utmSource: 'twitter', utmMedium: 'social', utmCampaign: 'first' },
            firstContentTouch: {
                occurredAt,
                utmSource: 'google',
                utmMedium: 'content',
                utmCampaign: 'older-valid',
                utmContent: 'article',
            },
            lastTouch: { occurredAt, ...last },
        })
        const { result } = renderHook(() => useMarketingQrUrl({ origin: 'https://peanut.me', context }))
        expect(Object.fromEntries(new URL(result.current!).searchParams)).toEqual({
            s: 'google',
            m: 'content',
            c: 'older-valid',
            n: 'article',
            o: 'saved_campaign',
        })
    }
)
