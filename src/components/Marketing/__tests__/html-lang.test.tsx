import { render, waitFor } from '@testing-library/react'
import { AppIntlProvider, useAppLocale } from '@/i18n/app/AppIntlProvider'
import { HtmlLang } from '@/components/Marketing/HtmlLang'
import LocalizedMarketingLayout from '@/app/[locale]/(marketing)/layout'
import RootPage from '@/app/page'
import EsLatamLandingPage from '@/app/es-419/page'
import EsArgentinaLandingPage from '@/app/es-ar/page'
import PtBrLandingPage from '@/app/pt-br/page'
import { localeReady } from '@/i18n/app/locale-store'

let mockPathname = '/'

jest.mock('next/navigation', () => ({
    usePathname: () => mockPathname,
}))

jest.mock('@/i18n/app/locale-store', () => ({
    currentAppLocale: jest.fn(() => null),
    emitDeviceContextToAnalytics: jest.fn(async () => {}),
    emitLocaleToAnalytics: jest.fn(),
    localeReady: jest.fn(async () => 'en'),
    markLocaleApplied: jest.fn(),
    persistLocale: jest.fn(),
}))

describe('localized marketing document language', () => {
    const mockedLocaleReady = jest.mocked(localeReady)

    beforeEach(() => {
        document.documentElement.lang = 'en'
        mockPathname = '/'
        mockedLocaleReady.mockResolvedValue('en')
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

    function LocaleProbe() {
        const { locale } = useAppLocale()
        return <span data-testid="app-locale">{locale}</span>
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

    it.each([
        ['en', RootPage],
        ['es-419', EsLatamLandingPage],
        ['es-ar', EsArgentinaLandingPage],
        ['pt-br', PtBrLandingPage],
    ] as const)('marks the literal %s landing page as its document-language owner', (locale, Page) => {
        expect(Page()).toMatchObject({
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

    it('restores the selected app locale after leaving a localized marketing route', async () => {
        mockedLocaleReady.mockResolvedValue('pt-BR')
        mockPathname = '/es-419/split/guides/example'
        const view = renderInMarketingRoot(
            { marker: 'es-419', lang: 'es-419' },
            <>
                <HtmlLang locale="es-419" />
                <LocaleProbe />
            </>
        )

        await waitFor(() => expect(view.getByTestId('app-locale')).toHaveTextContent('pt-BR'))
        expect(document.documentElement.lang).toBe('es-419')

        mockPathname = '/home'
        view.container.removeAttribute('data-marketing-locale')
        view.container.removeAttribute('lang')
        view.rerender(
            <AppIntlProvider>
                <LocaleProbe />
                <div>Product UI</div>
            </AppIntlProvider>
        )

        await waitFor(() => expect(document.documentElement.lang).toBe('pt-BR'))
    })

    it('preserves a literal landing locale when navigating from product UI', async () => {
        mockedLocaleReady.mockResolvedValue('pt-BR')
        mockPathname = '/home'
        const view = renderInMarketingRoot(
            {},
            <>
                <LocaleProbe />
                <div>Product UI</div>
            </>
        )

        await waitFor(() => expect(view.getByTestId('app-locale')).toHaveTextContent('pt-BR'))
        expect(document.documentElement.lang).toBe('pt-BR')

        mockPathname = '/es-419'
        view.container.dataset.marketingLocale = 'es-419'
        view.container.lang = 'es-419'
        view.rerender(
            <AppIntlProvider>
                <HtmlLang locale="es-419" />
                <LocaleProbe />
                <div>Localized landing</div>
            </AppIntlProvider>
        )

        await waitFor(() => expect(document.documentElement.lang).toBe('es-419'))
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
