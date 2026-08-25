import { Suspense } from 'react'
import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { listAllContent, type ContentItem } from '@/lib/content'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { Hero } from '@/components/Marketing/mdx/Hero'
import ContentLanding, { ContentLinkList, type ContentLandingStrings } from '@/components/Marketing/ContentLanding'

interface PageProps {
    params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    const i18n = getTranslations(locale)

    return {
        ...metadataHelper({
            locale,
            title: `${i18n.contentHubTitle} | Peanut`,
            description: i18n.contentHubSubtitle,
            canonical: `/${locale}/content`,
        }),
        alternates: {
            canonical: `/${locale}/content`,
            languages: getAlternates('content'),
        },
    }
}

/**
 * Suspense fallback — and the crawlable version of this page. ContentLanding reads the URL
 * through nuqs, so on a statically generated route Next prerenders this fallback in its place;
 * whatever renders here is what search engines get. Serve the real link list, and skeleton only
 * the search box that genuinely needs the client.
 */
function LandingFallback({ items, strings }: { items: ContentItem[]; strings: ContentLandingStrings }) {
    return (
        <>
            <div className="mx-auto mt-10 mb-6 max-w-[720px] px-6 md:mt-12 md:px-4">
                <div className="bg-gray-200 h-12 w-full animate-pulse rounded-sm border border-n-1" />
            </div>
            <ContentLinkList items={items} strings={strings} grouped />
        </>
    )
}

export default async function ContentHubPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const typedLocale = locale as Locale
    const i18n = getTranslations(typedLocale)
    const items = listAllContent(typedLocale)

    const strings: ContentLandingStrings = {
        searchPlaceholder: i18n.contentSearchPlaceholder,
        noResults: i18n.noContentResults,
        filterAll: i18n.filterAll,
        filterBlog: i18n.filterBlog,
        filterStories: i18n.filterStories,
        filterUseCases: i18n.filterUseCases,
        filterCompare: i18n.filterCompare,
    }

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.content, href: `/${locale}/content` },
            ]}
        >
            <Hero title={i18n.contentHubTitle} subtitle={i18n.contentHubSubtitle} />
            <Suspense fallback={<LandingFallback items={items} strings={strings} />}>
                <ContentLanding items={items} locale={typedLocale} strings={strings} />
            </Suspense>
        </ContentPage>
    )
}
