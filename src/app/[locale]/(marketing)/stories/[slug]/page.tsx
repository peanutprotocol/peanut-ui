import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized, listPublishedSlugs, type ContentFrontmatter } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

const STORY_SLUGS = listPublishedSlugs('stories')

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => STORY_SLUGS.map((slug) => ({ locale, slug })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    const mdxContent = readPageContentLocalized<ContentFrontmatter>('stories', slug, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    return {
        ...metadataHelper({
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${locale}/stories/${slug}`,
            dynamicOg: true,
        }),
        alternates: {
            canonical: `/${locale}/stories/${slug}`,
            languages: getAlternates('stories', slug),
        },
    }
}

export default async function StoryPage({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    const mdxSource = readPageContentLocalized<ContentFrontmatter>('stories', slug, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)
    const url = `/${locale}/stories/${slug}`

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: 'Stories', href: `/${locale}/stories` },
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
            {content}
        </ContentPage>
    )
}
