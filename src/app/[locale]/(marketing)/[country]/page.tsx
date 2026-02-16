import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { COUNTRIES_SEO, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, isValidLocale, getBareAlternates } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t } from '@/i18n'
import { HubPageContent } from '@/components/Marketing/pages/HubPageContent'

interface PageProps {
    params: Promise<{ locale: string; country: string }>
}

export async function generateStaticParams() {
    const countries = Object.keys(COUNTRIES_SEO)
    return SUPPORTED_LOCALES.flatMap((locale) => countries.map((country) => ({ locale, country })))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, country } = await params
    if (!isValidLocale(locale)) return {}

    const seo = COUNTRIES_SEO[country]
    if (!seo) return {}

    const i18n = getTranslations(locale as Locale)
    const countryName = getCountryName(country, locale as Locale)

    return {
        ...metadataHelper({
            title: `${t(i18n.hubTitle, { country: countryName })} | Peanut`,
            description: t(i18n.hubSubtitle, { country: countryName }),
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

    return <HubPageContent country={country} locale={locale as Locale} />
}
