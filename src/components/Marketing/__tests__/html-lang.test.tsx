import { render, waitFor } from '@testing-library/react'
import { AppIntlProvider } from '@/i18n/app/AppIntlProvider'
import { HtmlLang } from '@/components/Marketing/HtmlLang'
import LocalizedMarketingLayout from '@/app/[locale]/(marketing)/layout'

jest.mock('@/i18n/app/locale-store', () => ({
    currentAppLocale: jest.fn(() => null),
    emitDeviceContextToAnalytics: jest.fn(async () => {}),
    emitLocaleToAnalytics: jest.fn(),
    localeReady: jest.fn(async () => 'en'),
    markLocaleApplied: jest.fn(),
    persistLocale: jest.fn(),
}))

describe('localized marketing document language', () => {
    beforeEach(() => {
        document.documentElement.lang = 'en'
    })

    afterEach(() => {
        document.body.replaceChildren()
    })

    function renderInMarketingRoot({ marker, lang }: { marker?: string; lang?: string }, children?: React.ReactNode) {
        const marketingRoot = document.createElement('main')
        if (marker) marketingRoot.dataset.marketingLocale = marker
        if (lang) marketingRoot.lang = lang
        document.body.append(marketingRoot)

        return render(<AppIntlProvider>{children}</AppIntlProvider>, { container: marketingRoot })
    }

    it.each(['es-419', 'pt-br'] as const)('server-renders the %s route owner on the layout main', async (locale) => {
        const layout = await LocalizedMarketingLayout({
            children: <div>Guide</div>,
            params: Promise.resolve({ locale }),
        })

        expect(layout).toMatchObject({
            type: 'main',
            props: {
                'data-marketing-locale': locale,
                lang: locale,
            },
        })
    })

    it.each(['es-419', 'pt-br'] as const)(
        'keeps the route-owned %s locale after the global app locale provider hydrates',
        async (locale) => {
            renderInMarketingRoot({ marker: locale, lang: locale }, <HtmlLang locale={locale} />)

            await waitFor(() => expect(document.documentElement.lang).toBe(locale))
        }
    )

    it('uses the app locale when the page does not own a document language', async () => {
        render(
            <AppIntlProvider>
                <div>Product UI</div>
            </AppIntlProvider>
        )

        await waitFor(() => expect(document.documentElement.lang).toBe('en'))
    })

    it.each([
        [
            'an unmarked nested main',
            <main key="unmarked" lang="pt-br">
                Untrusted content
            </main>,
        ],
        [
            'a supported marked nested main',
            <main key="supported-nested" data-marketing-locale="pt-br" lang="pt-br">
                Spoofed route owner
            </main>,
        ],
        [
            'a nested mismatched marker and lang values',
            <main key="nested-mismatched" data-marketing-locale="es-419" lang="pt-br">
                Spoofed mismatched route
            </main>,
        ],
    ])('does not let %s override the product app locale', async (_case, content) => {
        render(<AppIntlProvider>{content}</AppIntlProvider>)

        await waitFor(() => expect(document.documentElement.lang).toBe('en'))
    })

    it.each([
        ['an unsupported direct route locale', { marker: 'fr', lang: 'fr' }],
        ['mismatched direct route marker and lang values', { marker: 'es-419', lang: 'pt-br' }],
    ])('does not let %s override the product app locale', async (_case, attributes) => {
        renderInMarketingRoot(attributes)

        await waitFor(() => expect(document.documentElement.lang).toBe('en'))
    })
})
