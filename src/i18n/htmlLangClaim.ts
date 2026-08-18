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

export function claimHtmlLang(): void {
    claims += 1
}

export function releaseHtmlLang(): void {
    claims = Math.max(0, claims - 1)
}

/** True while a `HtmlLang` is mounted and owns the attribute. */
export function isHtmlLangClaimed(): boolean {
    return claims > 0
}
