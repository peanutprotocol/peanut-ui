import type { Metadata } from 'next'
import { statusFeedOrigin } from './feed'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getTranslations } from '@/i18n'
import { getAlternatesFor, localizedPath } from '@/i18n/config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { StatusBanner, StatusBoard } from './StatusBoard'
import { isFresh, parseStatusSummary, type StatusSummary } from './types'

// The feed is resampled every 5 minutes; a minute of edge cache keeps a
// traffic spike during an incident off the API that is already struggling.
export const revalidate = 60

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
            // Cached, and therefore not to be trusted on its own.
            //
            // Next's Data Cache serves the last good body when a revalidating
            // fetch *fails*, silently — verified against a feed refusing every
            // connection, where this page went on rendering the last green
            // board indefinitely and the catch below never ran. `cache:
            // 'no-store'` fixes that and costs too much: it marks the route
            // dynamic (confirmed in the build output), so every visitor during
            // an incident would reach an API that is already struggling.
            //
            // So the cache stays and `isFresh` is what catches a dead origin:
            // a body Next keeps re-serving ages, and this page refuses it once
            // it has.
            next: { revalidate },
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
