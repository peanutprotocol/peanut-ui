import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SUPPORTED_LOCALES, getBareAlternatesFor, isValidLocale } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import {
    availableSingletonLocales,
    readSingletonContentLocalized,
    singletonLocaleFor,
    type ContentFrontmatter,
} from '@/lib/content'
import { renderContent } from '@/lib/mdx'

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

    const mdxContent = readSingletonContentLocalized<ContentFrontmatter>('pricing', locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    // A fallback-served page canonicalizes to the locale that owns the prose.
    const contentLocale = singletonLocaleFor('pricing', locale)

    return {
        ...metadataHelper({
            locale,
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${contentLocale}/pricing`,
            dynamicOg: true,
        }),
        alternates: {
            canonical: `/${contentLocale}/pricing`,
            languages: getBareAlternatesFor(availableSingletonLocales('pricing'), 'pricing'),
        },
    }
}

export default async function PricingPage({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const mdxSource = readSingletonContentLocalized<ContentFrontmatter>('pricing', locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body, locale)
    const i18n = getTranslations(locale)
    const url = `/${locale}/pricing`

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
