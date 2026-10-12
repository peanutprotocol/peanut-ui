// STORE_URL.ios carries Apple's campaign tokens only when the provider token
// is configured; otherwise the plain listing link (TASK-23382).
const PLAIN = 'https://apps.apple.com/us/app/id6786373552'

function loadStoreUrl(providerToken: string | undefined) {
    let storeUrl: { ios: string; android: string } | undefined
    jest.isolateModules(() => {
        if (providerToken === undefined) delete process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN
        else process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN = providerToken
        storeUrl = require('../migration.consts').STORE_URL
    })
    return storeUrl!
}

describe('STORE_URL.ios', () => {
    const original = process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN
    afterAll(() => {
        if (original === undefined) delete process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN
        else process.env.NEXT_PUBLIC_APP_STORE_PROVIDER_TOKEN = original
    })

    it('is the plain listing link without a provider token', () => {
        expect(loadStoreUrl(undefined).ios).toBe(PLAIN)
        expect(loadStoreUrl('').ios).toBe(PLAIN)
    })

    it('adds pt and ct=web with a provider token', () => {
        expect(loadStoreUrl('123456').ios).toBe(`${PLAIN}?pt=123456&ct=web`)
    })
})
