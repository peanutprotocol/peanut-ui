import { Suspense } from 'react'
import { type Metadata } from 'next'
import { notFound } from 'next/navigation'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { listAllContent } from '@/lib/content'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { Hero } from '@/components/Marketing/mdx/Hero'
import ContentLanding from '@/components/Marketing/ContentLanding'

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

function LandingSkeleton() {
    return (
        <div className="mx-auto mb-8 mt-10 max-w-[720px] px-6 md:mt-12 md:px-4">
            <div className="h-12 w-full animate-pulse rounded-sm border border-n-1 bg-gray-200" />
            <div className="mt-10 flex flex-col gap-10">
                {[1, 2, 3].map((i) => (
                    <div key={i}>
                        <div className="mb-4 h-3 w-32 animate-pulse rounded bg-gray-200" />
                        <div className="flex flex-col gap-px overflow-hidden rounded-sm border border-n-1">
                            {[1, 2, 3].map((j) => (
                                <div key={j} className="flex flex-col gap-1.5 bg-white px-5 py-4">
                                    <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                                    <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default async function ContentHubPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const typedLocale = locale as Locale
    const i18n = getTranslations(typedLocale)
    const items = listAllContent(typedLocale)

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.content, href: `/${locale}/content` },
            ]}
        >
            <Hero title={i18n.contentHubTitle} subtitle={i18n.contentHubSubtitle} />
            <Suspense fallback={<LandingSkeleton />}>
                <ContentLanding
                    items={items}
                    locale={typedLocale}
                    strings={{
                        searchPlaceholder: i18n.contentSearchPlaceholder,
                        noResults: i18n.noContentResults,
                        filterAll: i18n.filterAll,
                        filterBlog: i18n.filterBlog,
                        filterStories: i18n.filterStories,
                        filterUseCases: i18n.filterUseCases,
                        filterCompare: i18n.filterCompare,
                    }}
                />
            </Suspense>
        </ContentPage>
    )
}
