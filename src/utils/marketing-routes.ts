import { SUPPORTED_LOCALES } from '@/i18n/types'

const LOCALE_PREFIXES = new Set(SUPPORTED_LOCALES.map((locale) => locale.toLowerCase()))

/**
 * True for the marketing site — the landing page and the localized marketing
 * pages — which render server-side content and never touch the wallet.
 *
 * These routes skip the wallet provider tree (ZeroDev kernel, wagmi, and the
 * transfer-flow contexts), which the root layout otherwise mounts for every
 * route and which is the bulk of the landing page's JavaScript.
 *
 * A locale prefix is what identifies a marketing page, not the segment after
 * it: everything under a locale lives in `app/[locale]/(marketing)` or is a
 * localized landing page (`app/es-ar/page.tsx`), while the app's own routes are
 * never locale-prefixed. Matching on the segment alone would be actively
 * dangerous — `/withdraw` is a marketing page under a locale AND the app's
 * withdraw flow under `(mobile-ui)`, so the app route would lose the providers
 * it needs. Anything unrecognised therefore falls through to the app tree,
 * which costs bytes but never breaks a page.
 */
export function isMarketingRoute(pathname: string | null | undefined): boolean {
    if (!pathname) return false

    const segments = pathname.split('/').filter(Boolean)
    if (segments.length === 0) return true // '/' — the landing page

    return LOCALE_PREFIXES.has(segments[0].toLowerCase())
}
