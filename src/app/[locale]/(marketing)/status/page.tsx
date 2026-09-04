import type { Metadata } from 'next'
import { statusFeedOrigin } from './feed'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getTranslations } from '@/i18n'
import { getAlternatesFor, localizedPath } from '@/i18n/config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { StatusBanner, StatusBoard } from './StatusBoard'
import { isFresh, parseStatusSummary, type StatusSummary } from './types'

/**
 * Rendered per request, with the feed itself cached for a minute.
 *
 * The two caches here do different jobs, and only one of them may hold a
 * verdict. Under route-level ISR (`revalidate = 60`) Next answers the first
 * request after expiry from the *cached HTML* and only then regenerates behind
 * it: a locale that last rendered green and then went an hour without traffic
 * would serve that hour-old green to the next visitor while the freshness
 * check ran after they had already read it. That is this page's original bug
 * moved up a layer, so the route cache goes.
 *
 * The Data Cache on the feed stays, and is what keeps the API shielded — one
 * fetch a minute per region however much traffic an incident brings. What
 * makes that safe is `isFresh`, now evaluated before every response rather
 * than only on a background regeneration.
 *
 * `revalidate = 0` rather than `dynamic = 'force-dynamic'`: both render per
 * request and both leave the fetch below cached, but force-dynamic only leaves
 * it cached because the fetch names its own revalidate — drop that and
 * force-dynamic opts it out, taking the shield with it. This says the one
 * thing it means.
 */
export const revalidate = 0

/** Matches the feed's own `max-age=60`. */
const FEED_REVALIDATE_SECONDS = 60

export async function generateMetadata({ params }: { params: Promise<{ locale: Locale }> }): Promise<Metadata> {
    const { locale } = await params
    const resolved = locale ?? DEFAULT_LOCALE
    const i18n = getTranslations(resolved)
    const canonical = localizedPath('status', resolved)

    return {
        ...metadataHelper({
            locale: resolved,
            title: i18n.statusMetaTitle,
            description: i18n.statusPageSubtitle,
            canonical,
            // Branded card rather than the generic marketing image: this link
            // gets pasted into chats during an incident, and the unfurl is the
            // first thing anyone reads.
            dynamicOg: true,
            ogSubtitle: i18n.statusPageSubtitle,
        }),
        alternates: { canonical, languages: getAlternatesFor(SUPPORTED_LOCALES, 'status') },
        // Nothing here should compete with the marketing pages in search, and
        // a stale cached copy of an outage is worse than none. Unfurls are
        // unaffected — og:/twitter: tags are read regardless of robots.
        robots: { index: false, follow: true },
    }
}

async function loadSummary(): Promise<StatusSummary | null> {
    try {
        const response = await fetch(`${statusFeedOrigin()}/status/summary`, {
            // Cached, and therefore not trusted on its own. Next's Data
            // Cache serves the last good body when a revalidating fetch
            // *fails*, silently — verified against a feed refusing every
            // connection, where this page went on rendering the last green
            // board indefinitely and the catch below never ran. The cache
            // earns its place anyway (it is the API's shield); `isFresh` below
            // is what stops it answering for a backend that is gone.
            next: { revalidate: FEED_REVALIDATE_SECONDS },
            signal: AbortSignal.timeout(8000),
        })
        if (!response.ok) return null
        const summary = parseStatusSummary(await response.json())
        if (!summary || !isFresh(summary, Date.now())) return null
        return summary
    } catch {
        // Swallowed on purpose: this page's whole job is to render during an
        // outage, so a failed fetch is an expected state with its own copy,
        // not an error worth a 500.
        return null
    }
}

export default async function StatusPage({ params }: { params: Promise<{ locale: Locale }> }) {
    const { locale } = await params
    const i18n = getTranslations(locale ?? DEFAULT_LOCALE)
    const summary = await loadSummary()

    if (!summary) {
        // Red, not a neutral notice.
        //
        // This page renders on Vercel and the feed comes from Render, so the
        // fetch above is the one measurement the page can still make when the
        // backend is the thing that is broken — and it just came back
        // negative. Reporting that as an amber "try again shortly" is how a
        // status page whose data lives behind the outage reports the outage as
        // a hiccup.
        return (
            <div className="bg-background">
                <Hero title={i18n.statusPageTitle} subtitle={i18n.statusWindowLabel} />
                <div className="mx-auto w-full max-w-3xl px-6 pb-12">
                    <StatusBanner
                        state="down"
                        title={i18n.statusFeedUnreachableTitle}
                        detail={i18n.statusFeedUnreachable}
                    />
                </div>
            </div>
        )
    }

    return <StatusBoard summary={summary} locale={locale} i18n={i18n} />
}
