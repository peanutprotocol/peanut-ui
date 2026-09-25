export const APP_HELP_SLUGS = [
    'verification',
    'account-recovery',
    'transaction-limits',
    'request-money',
    'card-collateral',
    'passkeys',
    'security-disclosure',
] as const
export type AppHelpSlug = (typeof APP_HELP_SLUGS)[number]

export const HELP_LOCALES = ['en', 'es-419', 'es-ar', 'pt-br'] as const
export type HelpLocale = (typeof HELP_LOCALES)[number]

/** Literal props only: the article is data, so nothing in it can hold a function or an object. */
export type AppHelpNodeProps = Record<string, string | number | boolean>

/**
 * One node of a help article compiled at build time: a text run, or an HTML tag
 * or MDX component name with its props and children. The drawer maps names to
 * its own components, so the article carries no code.
 */
export type AppHelpNode = string | { t: string; p?: AppHelpNodeProps; c?: AppHelpNode[] }

export type AppHelpArticle = { title: string; body: AppHelpNode[] }

export const isAppHelpSlug = (slug: string): slug is AppHelpSlug =>
    APP_HELP_SLUGS.some((supported) => supported === slug)

export const isHelpLocale = (locale: string): locale is HelpLocale =>
    HELP_LOCALES.some((supported) => supported === locale)

/** App locales are cased (pt-BR); help content uses the lowercase marketing codes. */
export const toHelpLocale = (appLocale: string): HelpLocale => {
    const locale = appLocale.toLowerCase()
    return isHelpLocale(locale) ? locale : 'en'
}

/**
 * The static JSON file the build writes for one article. Web and the native
 * export both serve it from their own origin, so the drawer has one code path.
 */
export const appHelpArticlePath = (slug: AppHelpSlug, locale: HelpLocale) => `/app-help/${locale}/${slug}.json`

/** The public help page for an article, opened when the drawer cannot load it. */
export const appHelpPagePath = (slug: AppHelpSlug, locale: HelpLocale) => `/${locale}/help/${slug}`
