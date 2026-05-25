import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { listAllContent } from '@/lib/content'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { Hero } from '@/components/Marketing/mdx/Hero'
import ContentLanding from '@/components/Marketing/ContentLanding'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

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

    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${i18n.blog} | Peanut`,
            description: i18n.allArticles,
            canonical: `/${locale}/blog`,
        }),
        alternates: {
            canonical: `/${locale}/blog`,
            languages: getAlternates('blog'),
        },
    }
}

function BlogSkeleton() {
    return (
        <div className="mx-auto mb-8 mt-10 max-w-[720px] px-6 md:mt-12 md:px-4">
            <div className="h-12 w-full animate-pulse rounded-sm border border-n-1 bg-gray-200" />
            <div className="mt-10 flex flex-col gap-px overflow-hidden rounded-sm border border-n-1">
                {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="flex flex-col gap-1.5 bg-white px-5 py-4">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-gray-200" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
                    </div>
                ))}
            </div>
        </div>
    )
}

export default async function BlogIndexPageLocalized({ params }: PageProps) {
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
                { name: i18n.blog, href: `/${locale}/blog` },
            ]}
        >
            <Hero title={i18n.blog} subtitle={i18n.allArticles} />
            <Suspense fallback={<BlogSkeleton />}>
                <ContentLanding
                    items={items}
                    locale={typedLocale}
                    fixedType="blog"
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
