import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { SEND_TO_COUNTRIES, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternatesFor, isValidLocale, localizedPath } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import {
    readPageContentLocalized,
    type ContentFrontmatter,
    contentLocaleFor,
    availableContentLocales,
} from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; country: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => SEND_TO_COUNTRIES.map((country) => ({ locale, country })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, country } = await params
    if (!isValidLocale(locale)) return {}

    if (!SEND_TO_COUNTRIES.includes(country)) return {}

    const mdxContent = readPageContentLocalized<ContentFrontmatter>('send-to', country, locale)
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    // A fallback-served page canonicalizes to the locale that owns the prose.
    const contentLocale = contentLocaleFor('send-to', country, locale) as Locale

    return {
        ...metadataHelper({
            locale: contentLocale,
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${contentLocale}/send-money-to/${country}`,
            dynamicOg: true,
        }),
        alternates: {
            canonical: `/${contentLocale}/send-money-to/${country}`,
            languages: getAlternatesFor(availableContentLocales('send-to', country), 'send-money-to', country),
        },
    }
}

export default async function SendMoneyToCountryPageLocalized({ params }: PageProps) {
    const { locale, country } = await params
    if (!isValidLocale(locale)) notFound()

    const mdxSource = readPageContentLocalized<ContentFrontmatter>('send-to', country, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()
    const contentLocale = contentLocaleFor('send-to', country, locale) as Locale

    const { content } = await renderContent(mdxSource.body, locale)
    const i18n = getTranslations(locale)
    const countryName = getCountryName(country, locale)
    const url = localizedPath('send-money-to', locale, country)

    return (
        <ContentPage
            locale={locale}
            contentLocale={contentLocale}
            breadcrumbs={[
                { name: i18n.home, href: `/${locale}` },
                { name: countryName, href: url },
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
