/**
 * Releasing the <html lang> claim hands the attribute back to the app locale.
 *
 * Navigating off a localized landing unmounts HtmlLang. Restoring the snapshot
 * it captured on the way in is not enough: that snapshot is the root layout's
 * pre-hydration "en", so a pt-BR user would run the rest of the session under
 * lang="en". AppIntlProvider's own effect keys on the app locale, which did not
 * change, so nothing else puts it back.
 *
 * Its own file on purpose: the locale store memoizes the resolved startup
 * locale for the module's lifetime, so a preceding test in the same file would
 * change the timing this one depends on.
 */
import { act, render, waitFor } from '@testing-library/react'
import { AppIntlProvider } from '@/i18n/app/AppIntlProvider'
import { isHtmlLangClaimed } from '@/i18n/htmlLangClaim'
import { HtmlLang } from '../HtmlLang'

const APP_LOCALE = 'pt-BR'

beforeAll(() => {
    localStorage.setItem('app-locale', APP_LOCALE)
})

function Page({ onLanding }: { onLanding: boolean }) {
    return <AppIntlProvider>{onLanding ? <HtmlLang locale="es-419" /> : null}</AppIntlProvider>
}

it('restores the app locale, not the pre-hydration snapshot', async () => {
    // The root layout ships lang="en"; this is the snapshot HtmlLang captures.
    document.documentElement.lang = 'en'

    const { rerender } = render(<Page onLanding />)
    await waitFor(() => expect(document.documentElement.lang).toBe('es-419'))

    // Let the provider's async startup-locale resolution settle first.
    await act(() => new Promise((resolve) => setTimeout(resolve, 60)))
    expect(document.documentElement.lang).toBe('es-419')

    // Navigate off the landing.
    rerender(<Page onLanding={false} />)

    await waitFor(() => expect(document.documentElement.lang).toBe(APP_LOCALE))
    expect(isHtmlLangClaimed()).toBe(false)
})
