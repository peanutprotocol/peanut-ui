import { ContentLinkList, type ContentLandingStrings } from '@/components/Marketing/ContentLanding'
import { HUB_WIDTH } from '@/components/Marketing/constants'
import type { Locale } from '@/i18n/types'
import type { ContentItem } from '@/lib/content'

/**
 * Suspense fallback — and the crawlable version of the hub. ContentLanding reads the URL
 * through nuqs, so on a statically generated route Next prerenders this fallback in its place;
 * whatever renders here is what search engines get. Serve the real link list, and skeleton only
 * the search box that genuinely needs the client.
 */
export function ContentHubFallback({
    items,
    locale,
    strings,
}: {
    items: ContentItem[]
    locale: Locale
    strings: ContentLandingStrings
}) {
    return (
        <>
            {/* the hub column, shared with ContentLanding so the search box cannot
                jump width on hydration. h-10 is SearchInput's height — the skeleton
                renders the loaded layout. */}
            <div className={`mx-auto mt-10 mb-6 ${HUB_WIDTH} px-6 md:mt-12 md:px-4`}>
                <div className="h-10 w-full animate-pulse rounded-sm border border-border-default bg-foreground-primary/10" />
            </div>
            <ContentLinkList items={items} locale={locale} strings={strings} grouped />
        </>
    )
}
