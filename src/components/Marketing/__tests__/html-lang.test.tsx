/**
 * <html lang> ownership.
 *
 * Two components write document.documentElement.lang: AppIntlProvider (the app
 * locale, from cookie/navigator — never the URL) and HtmlLang (the page locale,
 * from the route). AppIntlProvider sits in ClientProviders, above every route,
 * and React commits parent effects after child ones — so it used to overwrite
 * the page locale on every localized landing. Live peanut.me/pt-br reported
 * lang="en" for exactly this reason.
 *
 * These render the REAL AppIntlProvider, not a stand-in, so deleting the guard
 * fails the suite. The app locale is forced to pt-BR — a NON-default value — so
 * that "the app locale won" and "nothing wrote anything" can be told apart.
 */
import { act, render, waitFor } from '@testing-library/react'
import { AppIntlProvider } from '@/i18n/app/AppIntlProvider'
import { isHtmlLangClaimed } from '@/i18n/htmlLangClaim'
import { HtmlLang } from '../HtmlLang'

const APP_LOCALE = 'pt-BR'

// Set before the first render: the store memoizes the startup locale for the
// session, and the provider resolves it inside its mount effect.
beforeAll(() => {
    localStorage.setItem('app-locale', APP_LOCALE)
})

describe('HtmlLang', () => {
    beforeEach(() => {
        document.documentElement.lang = 'en'
    })

    it('stamps the page locale onto <html lang>', () => {
        render(<HtmlLang locale="pt-br" />)
        expect(document.documentElement.lang.toLowerCase()).toBe('pt-br')
    })

    it('keeps the page locale when AppIntlProvider is mounted above it', async () => {
        // The live failure: the page is Spanish, the app locale is pt-BR, and
        // the provider's effect commits last.
        render(
            <AppIntlProvider>
                <HtmlLang locale="es-419" />
            </AppIntlProvider>
        )

        await waitFor(() => expect(document.documentElement.lang).toBe('es-419'))

        // Hold past the provider's async startup-locale resolution — the second
        // write, and the one that actually clobbered the page on live.
        await act(() => new Promise((resolve) => setTimeout(resolve, 50)))
        expect(document.documentElement.lang).toBe('es-419')
    })

    it('leaves AppIntlProvider in charge on routes that claim nothing', async () => {
        render(<AppIntlProvider>{null}</AppIntlProvider>)

        await waitFor(() => expect(document.documentElement.lang).toBe(APP_LOCALE))
        expect(isHtmlLangClaimed()).toBe(false)
    })
})
