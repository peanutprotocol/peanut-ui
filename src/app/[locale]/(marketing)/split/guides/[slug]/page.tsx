import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { getTranslations } from '@/i18n'
import { HREFLANG_MAP, isValidLocale } from '@/i18n/config'
import { LOCALE_META } from '@/i18n/localeMeta'
import { renderContent } from '@/lib/mdx'
import {
    buildSplitGuideBlogPosting,
    buildSplitGuideMetadata,
    getAvailableSplitGuideLocales,
    getSplitGuideStaticParams,
    readPublishedSplitGuide,
    splitGuideDate,
    splitGuidePath,
} from '@/lib/split-guides'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

export function generateStaticParams() {
    return getSplitGuideStaticParams()
}

export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    const guide = readPublishedSplitGuide(slug, locale)
    if (!guide) return {}

    return buildSplitGuideMetadata(guide.frontmatter, locale, slug, getAvailableSplitGuideLocales(slug))
}

export default async function SplitGuidePage({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    const guide = readPublishedSplitGuide(slug, locale)
    if (!guide) notFound()

    const { content } = await renderContent(guide.body, locale)
    const availableLocales = getAvailableSplitGuideLocales(slug)
    const i18n = getTranslations(locale)
    const url = splitGuidePath(locale, slug)
    const date = splitGuideDate(guide.frontmatter)
    if (!date) notFound()

    return (
        <>
            <JsonLd data={buildSplitGuideBlogPosting(guide.frontmatter, locale, slug)} />
            <ContentPage
                locale={locale}
                breadcrumbs={[
                    { name: i18n.home, href: `/${locale}` },
                    { name: guide.frontmatter.title, href: url },
                ]}
            >
                <div className="mx-auto max-w-[640px] px-6 pb-12 pt-8 md:px-4 md:pt-12">
                    {availableLocales.length > 1 && (
                        <nav aria-label={i18n.footerLanguage} className="mb-6 flex flex-wrap gap-2">
                            {availableLocales.map((candidate) => (
                                <Link
                                    key={candidate}
                                    href={splitGuidePath(candidate, slug)}
                                    hrefLang={HREFLANG_MAP[candidate]}
                                    aria-current={candidate === locale ? 'page' : undefined}
                                    className={`rounded-sm border border-n-1 px-2 py-1 text-xs font-semibold transition-colors hover:bg-primary-3/30 ${
                                        candidate === locale ? 'bg-primary-1/20' : 'bg-white'
                                    }`}
                                >
                                    {LOCALE_META[candidate].shortLabel}
                                </Link>
                            ))}
                        </nav>
                    )}
                    <header className="mb-8 border-b border-n-1 pb-6">
                        <h1 className="text-3xl font-bold md:text-4xl">{guide.frontmatter.title}</h1>
                        <p className="mt-2 text-gray-600">{guide.frontmatter.description}</p>
                        <time dateTime={date} className="mt-3 block text-sm text-gray-400">
                            {date}
                        </time>
                    </header>
                </div>
                {content}
            </ContentPage>
        </>
    )
}
