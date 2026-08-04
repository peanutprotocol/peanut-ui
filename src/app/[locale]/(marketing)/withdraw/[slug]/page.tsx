import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getAlternatesFor, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import {
    readPageContentLocalized,
    listPublishedSlugs,
    type ContentFrontmatter,
    contentLocaleFor,
    availableContentLocales,
} from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; slug: string }>
}

const WITHDRAW_SLUGS = listPublishedSlugs('withdraw')

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => WITHDRAW_SLUGS.map((slug) => ({ locale, slug })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) return {}

    const mdxContent = readPageContentLocalized<ContentFrontmatter>('withdraw', slug, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    // A fallback-served page canonicalizes to the locale that owns the prose.
    const contentLocale = contentLocaleFor('withdraw', slug, locale)

    return {
        ...metadataHelper({
            locale,
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${contentLocale}/withdraw/${slug}`,
            dynamicOg: true,
        }),
        alternates: {
            canonical: `/${contentLocale}/withdraw/${slug}`,
            languages: getAlternatesFor(availableContentLocales('withdraw', slug), 'withdraw', slug),
        },
    }
}

export default async function WithdrawPage({ params }: PageProps) {
    const { locale, slug } = await params
    if (!isValidLocale(locale)) notFound()

    const mdxSource = readPageContentLocalized<ContentFrontmatter>('withdraw', slug, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body, locale)
    const i18n = getTranslations(locale)
    const url = `/${locale}/withdraw/${slug}`

    return (
        <ContentPage
            locale={locale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
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
