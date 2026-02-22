import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { COUNTRIES_SEO, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, isValidLocale, getBareAlternates } from '@/i18n/config'
import { getTranslations } from '@/i18n'
import { ContentPage } from '@/components/Marketing/ContentPage'
import { readPageContentLocalized } from '@/lib/content'
import { renderContent } from '@/lib/mdx'

interface PageProps {
    params: Promise<{ locale: string; country: string }>
}

export async function generateStaticParams() {
    const countries = Object.keys(COUNTRIES_SEO)
    return SUPPORTED_LOCALES.flatMap((locale) => countries.map((country) => ({ locale, country })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, country } = await params
    if (!isValidLocale(locale)) return {}

    const seo = COUNTRIES_SEO[country]
    if (!seo) return {}

    const mdxContent = readPageContentLocalized<{ title: string; description: string; published?: boolean }>(
        'countries',
        country,
        locale
    )
    if (!mdxContent || mdxContent.frontmatter.published === false) return {}

    return {
        ...metadataHelper({
            title: mdxContent.frontmatter.title,
            description: mdxContent.frontmatter.description,
            canonical: `/${locale}/${country}`,
        }),
        alternates: {
            canonical: `/${locale}/${country}`,
            languages: getBareAlternates(country),
        },
    }
}

export default async function CountryHubPage({ params }: PageProps) {
    const { locale, country } = await params
    if (!isValidLocale(locale)) notFound()
    if (!COUNTRIES_SEO[country]) notFound()

    const mdxSource = readPageContentLocalized('countries', country, locale)
    if (!mdxSource || mdxSource.frontmatter.published === false) notFound()

    const { content } = await renderContent(mdxSource.body)
    const i18n = getTranslations(locale)
    const countryName = getCountryName(country, locale)

    return (
        <ContentPage
            breadcrumbs={[
                { name: i18n.home, href: '/' },
                { name: countryName, href: `/${locale}/${country}` },
            ]}
        >
            {content}
        </ContentPage>
    )
}
