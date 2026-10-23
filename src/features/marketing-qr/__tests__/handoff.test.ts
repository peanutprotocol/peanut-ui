/** @jest-environment jsdom */
import { marketingQrAnalyticsAllowed } from '../consent'
import { getMarketingQrRegistration, parseMarketingQrQuery } from '../contract'
import { renderMarketingQrHandoff, runMarketingQrHandoff } from '../handoff'

const registration = getMarketingQrRegistration('home-hero-en')!
const originalKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
const browserProperties = [
    [window, 'location'],
    [window, 'fetch'],
    [crypto, 'randomUUID'],
    [navigator, 'globalPrivacyControl'],
    [document, 'prerendering'],
] as const
const originalProperties = browserProperties.map(([target, name]) => ({
    target,
    name,
    descriptor: Object.getOwnPropertyDescriptor(target, name),
}))
beforeEach(() => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = 'test-key'
    localStorage.clear()
    document.cookie = '__ph_opt_in_out_test-key=; Max-Age=0; path=/'
})
afterEach(() => {
    jest.restoreAllMocks()
    for (const { target, name, descriptor } of originalProperties) {
        if (descriptor) Object.defineProperty(target, name, descriptor)
        else Reflect.deleteProperty(target, name)
    }
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
    // Execute the exported helper in Jest's realm so coverage counters retain
    // their module closure. Browser QA executes the compiled standalone script.
    // Read the renderer's actual JSON argument without evaluating either body.
    const prefix = `(${runMarketingQrHandoff.toString()})(`
    const suffix = `,${marketingQrAnalyticsAllowed.toString()});`
    expect(script[2].startsWith(prefix)).toBe(true)
    expect(script[2].endsWith(suffix)).toBe(true)
    const state = JSON.parse(script[2].slice(prefix.length, -suffix.length)) as Parameters<
        typeof runMarketingQrHandoff
    >[0]
    const replace = jest.fn()
    const fetch = jest.fn((_url: string, _options: RequestInit): Promise<Response> => {
        if (throwingFetch) throw new Error('blocked')
        return new Promise(() => {})
    })
    const callbacks: Array<() => void> = []
    const doc = document as Document & { prerendering: boolean }
    Object.defineProperty(window, 'location', { configurable: true, value: { replace } })
    Object.defineProperty(window, 'fetch', { configurable: true, value: fetch })
    Object.defineProperty(crypto, 'randomUUID', {
        configurable: true,
        value: () => 'ce3055cb-9106-48ef-9c7c-098211fa3e3c',
    })
    Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: gpc })
    Object.defineProperty(doc, 'prerendering', { configurable: true, writable: true, value: prerendering })
    jest.spyOn(doc, 'addEventListener').mockImplementation((name, callback) => {
        if (name === 'prerenderingchange' && typeof callback === 'function') {
            callbacks.push(() => callback.call(doc, new Event(name)))
        }
    })
    if (optOut) localStorage.setItem('__ph_opt_in_out_test-key', '0')
    if (storageThrows) {
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked')
        })
    }
    runMarketingQrHandoff(state, marketingQrAnalyticsAllowed)
    return { replace, fetch, document: doc, callbacks, html }
}

it('runs the exported helper with rendered configuration and navigates before analytics resolves', async () => {
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
