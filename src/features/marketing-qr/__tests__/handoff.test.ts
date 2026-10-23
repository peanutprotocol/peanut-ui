/** @jest-environment node */
import { runInNewContext } from 'node:vm'
import { getMarketingQrRegistration, parseMarketingQrQuery } from '../contract'
import { renderMarketingQrHandoff } from '../handoff'

const registration = getMarketingQrRegistration('home-hero-en')!
const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'
})
afterAll(() => {
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = originalKey
})

async function browser({
    optOut = false,
    storageThrows = false,
    gpc = false,
    prerendering = false,
    captureEnabled = true,
    throwingFetch = false,
} = {}) {
    const attribution = parseMarketingQrQuery(registration, new URLSearchParams('s=google&m=cpc&c=launch'))
    const { html, csp } = await renderMarketingQrHandoff(registration, attribution, captureEnabled)
    const script = html.match(/<script nonce="([^"]+)">([\s\S]+)<\/script>/)!
    expect(csp).toContain(`'nonce-${script[1]}'`)
    const replace = jest.fn()
    const fetch = jest.fn((_url: string, _options: RequestInit) => {
        if (throwingFetch) throw new Error('blocked')
        return new Promise(() => {})
    })
    const callbacks: Array<() => void> = []
    const document = {
        cookie: '',
        prerendering,
        addEventListener: (_name: string, callback: () => void) => callbacks.push(callback),
    }
    runInNewContext(script[2], {
        window: {
            localStorage: {
                getItem: () => {
                    if (storageThrows) throw new Error('blocked')
                    return optOut ? '0' : null
                },
            },
            location: { replace },
        },
        navigator: { globalPrivacyControl: gpc },
        document,
        fetch,
        crypto: { randomUUID: () => 'ce3055cb-9106-48ef-9c7c-098211fa3e3c' },
        Date,
    })
    return { replace, fetch, document, callbacks, html }
}

it('runs its actual inline script without app globals and navigates before analytics resolves', async () => {
    const result = await browser()
    expect(result.fetch).toHaveBeenCalledTimes(1)
    expect(result.fetch.mock.calls[0][0]).toBe('/api/marketing-qr/open')
    const options = result.fetch.mock.calls[0][1] as RequestInit
    expect(options).toMatchObject({ credentials: 'omit', keepalive: true, referrerPolicy: 'no-referrer' })
    expect(JSON.parse(options.body as string)).toMatchObject({
        qr_id: 'home-hero-en',
        utm_source: 'google',
        event_id: 'ce3055cb-9106-48ef-9c7c-098211fa3e3c',
    })
    expect(result.replace).toHaveBeenCalledWith(expect.stringContaining('qr_analytics=allow'))
})

it.each([{ optOut: true }, { storageThrows: true }, { gpc: true }, { captureEnabled: false }])(
    'continues without a campaign or new event when capture is suppressed %j',
    async (options) => {
        const result = await browser(options)
        expect(result.fetch).not.toHaveBeenCalled()
        expect(result.replace).toHaveBeenCalledWith('/home?app_entry=1&marketing_qr=home-hero-en&qr_analytics=deny')
        expect(result.html).toContain('href="https://play.google.com/store/apps/details?id=me.peanut.wallet"')
    }
)

it('waits for prerender activation and handles duplicate activation once', async () => {
    const result = await browser({ prerendering: true })
    expect(result.fetch).not.toHaveBeenCalled()
    expect(result.replace).not.toHaveBeenCalled()
    result.document.prerendering = false
    result.callbacks[0]()
    result.callbacks[0]()
    expect(result.fetch).toHaveBeenCalledTimes(1)
    expect(result.replace).toHaveBeenCalledTimes(1)
})

it('continues after a synchronously blocked capture transport', async () => {
    const result = await browser({ throwingFetch: true })
    expect(result.replace).toHaveBeenCalledTimes(1)
})

it('escapes structured configuration so it cannot terminate the script', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test</script><img src=x>'
    const result = await browser()
    expect(result.html.match(/<script /g)).toHaveLength(1)
    expect(result.html).not.toContain('<img src=x>')
})
