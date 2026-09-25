import { BASE_URL } from '@/constants/general.consts'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'
import {
    appHelpArticlePath,
    appHelpPagePath,
    type AppHelpArticle,
    type AppHelpSlug,
    type HelpLocale,
} from './appHelpTypes'

const articles = new Map<string, Promise<AppHelpArticle>>()

async function fetchArticle(slug: AppHelpSlug, locale: HelpLocale): Promise<AppHelpArticle | null> {
    const response = await fetch(appHelpArticlePath(slug, locale))
    return response.ok ? ((await response.json()) as AppHelpArticle) : null
}

/**
 * Load one article in the reader's locale, or in English when that locale has
 * none. Rejects when neither exists. A loaded article is kept for the session;
 * a failed load is retried on the next open.
 */
export function loadAppHelpArticle(slug: AppHelpSlug, locale: HelpLocale): Promise<AppHelpArticle> {
    const key = `${locale}/${slug}`
    const cached = articles.get(key)
    if (cached) return cached

    const pending = (async () => {
        const article = (await fetchArticle(slug, locale)) ?? (locale === 'en' ? null : await fetchArticle(slug, 'en'))
        if (!article) throw new Error(`App help article unavailable: ${slug}/${locale}`)
        return article
    })()
    articles.set(key, pending)
    pending.catch(() => articles.delete(key))
    return pending
}

/**
 * Open the public help page instead of the drawer. Native opens the production
 * URL in the in-app browser, because the static export has no help pages. Web
 * opens a new tab, or navigates this tab when the browser blocks the tab.
 */
export function openAppHelpPage(slug: AppHelpSlug, locale: HelpLocale): void {
    const path = appHelpPagePath(slug, locale)
    if (isCapacitor()) {
        void openExternalUrl(`${BASE_URL}${path}`)
        return
    }
    const tab = window.open(path, '_blank')
    if (tab) tab.opener = null
    else window.location.assign(path)
}
