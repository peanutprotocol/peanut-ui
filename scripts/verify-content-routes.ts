const LOCALE_REDIRECTS = {
    'es-es': 'es-419',
} as const

/**
 * A retired-locale URL is valid only when its redirect destination is a real
 * route. Accepting the alias prefix by itself would hide broken links such as
 * /es-es/definitely-not-a-route.
 */
export function isKnownRouteOrLocaleRedirect(url: string, validPaths: ReadonlySet<string>): boolean {
    if (validPaths.has(url)) return true

    for (const [sourceLocale, destinationLocale] of Object.entries(LOCALE_REDIRECTS)) {
        const sourceRoot = `/${sourceLocale}`
        if (url !== sourceRoot && !url.startsWith(`${sourceRoot}/`)) continue
        if (url === sourceRoot) return true

        const destination = `/${destinationLocale}${url.slice(sourceRoot.length)}`
        return validPaths.has(destination)
    }

    return false
}
