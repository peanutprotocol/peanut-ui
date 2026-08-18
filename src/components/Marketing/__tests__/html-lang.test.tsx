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
 * fails the suite.
 */
import { render, waitFor } from '@testing-library/react'
import { AppIntlProvider } from '@/i18n/app/AppIntlProvider'
import { isHtmlLangClaimed } from '@/i18n/htmlLangClaim'
import { HtmlLang } from '../HtmlLang'

describe('HtmlLang', () => {
    beforeEach(() => {
        document.documentElement.lang = 'en'
    })

    it('stamps the page locale onto <html lang>', () => {
        render(<HtmlLang locale="pt-br" />)
        expect(document.documentElement.lang.toLowerCase()).toBe('pt-br')
    })

    it('restores the previous lang and releases the claim on unmount', () => {
        const { unmount } = render(<HtmlLang locale="pt-br" />)
        unmount()
        expect(document.documentElement.lang).toBe('en')
        expect(isHtmlLangClaimed()).toBe(false)
    })

    it('keeps the page locale when AppIntlProvider is mounted above it', async () => {
        // The live failure: a direct hit on /pt-br from an English browser, so
        // the app locale resolves to 'en' while the page locale is 'pt-br'.
        render(
            <AppIntlProvider>
                <HtmlLang locale="pt-br" />
            </AppIntlProvider>
        )

        await waitFor(() => expect(document.documentElement.lang.toLowerCase()).toBe('pt-br'))

        // Hold past the provider's async startup-locale resolution, which is the
        // second write that used to clobber the page locale.
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(document.documentElement.lang.toLowerCase()).toBe('pt-br')
    })

    it('leaves AppIntlProvider in charge on routes that claim nothing', async () => {
        render(<AppIntlProvider>{null}</AppIntlProvider>)

        await waitFor(() => expect(document.documentElement.lang).toBe('en'))
        expect(isHtmlLangClaimed()).toBe(false)
    })
})
