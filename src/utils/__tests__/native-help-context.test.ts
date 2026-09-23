describe('native Help Center browser context', () => {
    const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL
    let context: typeof import('../native-help-context')

    beforeEach(() => {
        jest.resetModules()
        sessionStorage.clear()
        window.history.replaceState({}, '', '/en/help')
        process.env.NEXT_PUBLIC_BASE_URL = 'https://staging.peanut.me'
        context = require('../native-help-context')
    })

    afterEach(() => {
        jest.restoreAllMocks()
        sessionStorage.clear()
        window.history.replaceState({}, '', '/')
        if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
        else process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl
    })

    it.each(['', '/en', '/es-419', '/es-ar', '/pt-br'])(
        'marks %s help links and preserves the query and anchor',
        (locale) => {
            const href = `https://peanut.me${locale}/help/passkeys?topic=account#recovery`
            expect(context.withNativeHelpContext(href)).toBe(
                `https://peanut.me${locale}/help/passkeys?topic=account&fromNativeApp=1#recovery`
            )
        }
    )

    it('supports the configured preview origin', () => {
        process.env.NEXT_PUBLIC_BASE_URL = 'https://peanut-preview.vercel.app'
        expect(context.withNativeHelpContext('https://peanut-preview.vercel.app/en/help')).toBe(
            'https://peanut-preview.vercel.app/en/help?fromNativeApp=1'
        )
    })

    it.each([
        'https://provider.example/help',
        'https://peanut.me.evil.example/en/help',
        'https://notpeanut.me/en/help',
        'https://peanut.me/home',
        'https://peanut.me/en/helpful',
        'mailto:support@peanut.me',
        '/en/help',
    ])('leaves unrelated URLs unchanged: %s', (href) => {
        expect(context.withNativeHelpContext(href)).toBe(href)
    })

    it('keeps native context through an article, locale change and document reload in the same tab', () => {
        window.history.replaceState({}, '', '/en/help?fromNativeApp=1')
        expect(context.isNativeHelpContext()).toBe(true)
        window.history.replaceState({}, '', '/pt-br/help/passkeys')
        expect(context.isNativeHelpContext()).toBe(true)
        jest.resetModules()
        const reloaded = require('../native-help-context') as typeof context
        expect(reloaded.isNativeHelpContext()).toBe(true)
    })

    it('leaves an ordinary browser visit unchanged', () => {
        window.history.replaceState({}, '', '/en/help?fromNativeApp=0')
        expect(context.isNativeHelpContext()).toBe(false)
    })

    it('retains context during client navigation when browser storage is unavailable', () => {
        jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new Error('storage blocked')
        })
        jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('storage blocked')
        })
        window.history.replaceState({}, '', '/en/help?fromNativeApp=1')
        expect(context.isNativeHelpContext()).toBe(true)
        window.history.replaceState({}, '', '/es-ar/help/passkeys')
        expect(context.isNativeHelpContext()).toBe(true)
    })
})
