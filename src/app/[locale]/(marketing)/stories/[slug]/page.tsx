import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternatesFor, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { ArticleBackNav } from '@/components/Marketing/ArticleBackNav'
import {
    readPageContentLocalized,
    listPublishedSlugs,
    type ContentFrontmatter,
    contentLocaleFor,
    availableContentLocales,
} from '@/lib/content'
import type { Locale } from '@/i18n/types'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

// 'index' is the legacy stories/index/ directory — the hub at /stories owns that URL space.
const STORY_SLUGS = listPublishedSlugs('stories').filter((slug) => slug !== 'index')

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => STORY_SLUGS.map((slug) => ({ locale, slug })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    const mdxContent = readPageContentLocalized<ContentFrontmatter>('stories', slug, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    // A fallback-served page canonicalizes to the locale that owns the prose.
    const contentLocale = contentLocaleFor('stories', slug, locale)

    return {
        ...metadataHelper({
            locale,
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${contentLocale}/stories/${slug}`,
            dynamicOg: true,
        }),
        alternates: {
            canonical: `/${contentLocale}/stories/${slug}`,
            languages: getAlternatesFor(availableContentLocales('stories', slug), 'stories', slug),
        },
    }
}

export default async function StoryPage({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    const mdxSource = readPageContentLocalized<ContentFrontmatter>('stories', slug, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body, locale)
    const i18n = getTranslations(locale)
    const url = `/${locale}/stories/${slug}`

    const localizedHrefs = Object.fromEntries(SUPPORTED_LOCALES.map((l) => [l, `/${l}/stories/${slug}`])) as Record<
        Locale,
        string
    >

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: i18n.filterStories, href: `/${locale}/stories` },
                { name: mdxSource.frontmatter.title, href: url },
            ]}
            article={
                mdxSource.frontmatter.generated_at
                    ? {
                          title: mdxSource.frontmatter.title,
                          description: mdxSource.frontmatter.description,
                          url,
                          datePublished: mdxSource.frontmatter.generated_at,
                      }
                    : undefined
            }
        >
            <div className="mx-auto max-w-[640px] px-6 pt-4 md:px-4">
                <ArticleBackNav
                    parentLabel={i18n.filterStories}
                    parentHref={`/${locale}/stories`}
                    backToTemplate={i18n.backTo}
                    currentLocale={locale as Locale}
                    localizedHrefs={localizedHrefs}
                />
            </div>
            {content}
        </ContentPage>
    )
}
