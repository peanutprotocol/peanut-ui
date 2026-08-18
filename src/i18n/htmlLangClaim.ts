/**
 * Ownership flag for `<html lang>`, shared by the two components that write it.
 *
 * `AppIntlProvider` stamps the *app* locale (cookie / navigator, never the URL)
 * and lives in `ClientProviders`, above every route. `HtmlLang` stamps the
 * *page* locale on marketing/landing routes. React commits child effects before
 * parent ones, so without this flag the provider always runs last and silently
 * overwrites the page locale — `peanut.me/pt-br` reports `lang="en"`.
 *
 * A counter rather than a boolean so paired mount/unmount survives React
 * StrictMode's double-invoke and overlapping route transitions.
 */
let claims = 0
let onRelease: (() => void) | null = null

/**
 * Lets `AppIntlProvider` re-apply the app locale when the last page claim drops.
 * Its own effect keys on the app locale, which does not change when the user
 * navigates off a localized landing — so without this the attribute would keep
 * whatever `HtmlLang` restored on the way out.
 */
export function setHtmlLangReleaseListener(listener: (() => void) | null): void {
    onRelease = listener
}

export function claimHtmlLang(): void {
    claims += 1
}

export function releaseHtmlLang(): void {
    claims = Math.max(0, claims - 1)
    if (claims === 0) onRelease?.()
}

/** True while a `HtmlLang` is mounted and owns the attribute. */
export function isHtmlLangClaimed(): boolean {
    return claims > 0
}
