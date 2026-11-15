/** @jest-environment node */
import { sendMarketingQrAppOpening } from '../appOpening'
import { marketingQrAnalyticsAllowed } from '../consent'
import { parseMarketingQrOpening } from '../server'
import { isAnalyticsCaptureBuild } from '@/utils/posthog-setup'

jest.mock('../consent', () => ({ marketingQrAnalyticsAllowed: jest.fn() }))
jest.mock('@/utils/posthog-setup', () => ({ isAnalyticsCaptureBuild: jest.fn() }))
jest.mock('@/constants/general.consts', () => ({ SELF_URL: 'https://peanut.me' }))

const originalFetch = global.fetch
const fetchMock = jest.fn((_url: string, _init: RequestInit) => Promise.resolve(new Response(null, { status: 204 })))
const sent = () => {
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    return { url, init, body: JSON.parse(init.body as string) }
}

beforeEach(() => {
    jest.clearAllMocks()
    global.fetch = fetchMock as unknown as typeof fetch
    jest.mocked(marketingQrAnalyticsAllowed).mockReturnValue(true)
    jest.mocked(isAnalyticsCaptureBuild).mockReturnValue(true)
})
afterAll(() => {
    global.fetch = originalFetch
})

it('sends the opening anonymously with the QR campaign, in the shape the endpoint accepts', () => {
    sendMarketingQrAppOpening(
        new URL('https://peanut.me/home?mqr=home-hero-en&s=twitter&m=social&c=qr-test&o=current_url')
    )
    const { url, init, body } = sent()
    expect(url).toBe('https://peanut.me/api/marketing-qr/open')
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer' })
    expect(body).toMatchObject({
        qr_id: 'home-hero-en',
        utm_source: 'twitter',
        utm_medium: 'social',
        utm_campaign: 'qr-test',
        attribution_origin: 'current_url',
        attribution_adjustment: 'none',
    })
    expect(parseMarketingQrOpening(body)).not.toBeNull()
})

it('uses the placement defaults when the QR carries no campaign', () => {
    sendMarketingQrAppOpening(new URL('https://peanut.me/home?mqr=qr-brazil-close-sticker-en'))
    expect(sent().body).toMatchObject({
        qr_id: 'qr-brazil-close-sticker-en',
        utm_source: 'star-lp',
        utm_campaign: 'qr-br',
        utm_content: 'c',
        attribution_origin: 'placement_default',
    })
})

it.each([
    [
        'analytics is declined',
        'https://peanut.me/home?mqr=home-hero-en',
        () => jest.mocked(marketingQrAnalyticsAllowed).mockReturnValue(false),
    ],
    [
        'the build sends no analytics',
        'https://peanut.me/home?mqr=home-hero-en',
        () => jest.mocked(isAnalyticsCaptureBuild).mockReturnValue(false),
    ],
    ['the QR is not registered', 'https://peanut.me/home?mqr=send-hero-en', () => {}],
    ['the link is not /home', 'https://peanut.me/app?mqr=home-hero-en', () => {}],
    ['the QR carries an unknown key', 'https://peanut.me/home?mqr=home-hero-en&wid=person', () => {}],
    ['it is a plain download QR', 'https://peanut.me/home?app_entry=1', () => {}],
])('sends nothing when %s', (_case, url, arrange) => {
    arrange()
    sendMarketingQrAppOpening(new URL(url))
    expect(fetchMock).not.toHaveBeenCalled()
})
