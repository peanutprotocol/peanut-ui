import type { Metadata } from 'next'
import { statusFeedOrigin } from './feed'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { getTranslations } from '@/i18n'
import { getAlternatesFor, localizedPath } from '@/i18n/config'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, type Locale } from '@/i18n/types'
import { Hero } from '@/components/Marketing/mdx/Hero'
import { StatusBoard } from './StatusBoard'
import { parseStatusSummary, type StatusSummary } from './types'

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
            next: { revalidate },
            signal: AbortSignal.timeout(8000),
        })
        if (!response.ok) return null
        return parseStatusSummary(await response.json())
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
        // Same header as the loaded page: this is a normal state, not an
        // error page, and it is the one on show whenever the feed's own
        // backend is the thing that is down.
        return (
            <>
                <Hero title={i18n.statusPageTitle} subtitle={i18n.statusWindowLabel} />
                <div className="mx-auto w-full max-w-3xl px-6 pb-12">
                    {/* secondary-2 died with the v4 theme; yellow-500 keeps the warning tone */}
                    <p className="rounded-md border border-yellow-500 bg-secondary-4 p-4 text-sm">
                        {i18n.statusFetchFailed}
                    </p>
                </div>
            </>
        )
    }

    return <StatusBoard summary={summary} locale={locale} i18n={i18n} />
}
