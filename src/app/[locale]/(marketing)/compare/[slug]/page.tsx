import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { COMPETITORS } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized, type ContentFrontmatter } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

export async function generateStaticParams() {
    const slugs = Object.keys(COMPETITORS)
    return SUPPORTED_LOCALES.flatMap((locale) => slugs.map((slug) => ({ locale, slug: `peanut-vs-${slug}` })))
}
export const dynamicParams = false

/** Strip the "peanut-vs-" URL prefix to get the data key. Returns null if prefix missing. */
function parseSlug(raw: string): string | null {
    if (!raw.startsWith('peanut-vs-')) return null
    return raw.slice('peanut-vs-'.length)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug: rawSlug } = await params
    if (!isValidLocale(locale)) return {}

    const slug = parseSlug(rawSlug)
    if (!slug) return {}
    const competitor = COMPETITORS[slug]
    if (!competitor) return {}

    const mdxContent = readPageContentLocalized<ContentFrontmatter>('compare', slug, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    return {
        ...metadataHelper({
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${locale}/compare/peanut-vs-${slug}`,
            dynamicOg: true,
        }),
        alternates: {
            canonical: `/${locale}/compare/peanut-vs-${slug}`,
            languages: getAlternates('compare', `peanut-vs-${slug}`),
        },
    }
}

export default async function ComparisonPageLocalized({ params }: PageProps) {
    const { locale, slug: rawSlug } = await params
    if (!isValidLocale(locale)) notFound()

    const slug = parseSlug(rawSlug)
    if (!slug) notFound()
    const competitor = COMPETITORS[slug]
    if (!competitor) notFound()

    const mdxSource = readPageContentLocalized<ContentFrontmatter>('compare', slug, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)
    const url = `/${locale}/compare/peanut-vs-${slug}`

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: `Peanut vs ${competitor.name}`, href: url },
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
