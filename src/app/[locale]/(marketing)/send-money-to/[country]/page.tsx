import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { COUNTRIES_SEO, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t } from '@/i18n'
import { CorridorPageContent } from '@/components/Marketing/pages/CorridorPageContent'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'

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

    const i18n = getTranslations(locale as Locale)
    const countryName = getCountryName(country, locale as Locale)
    const mapping = countryCurrencyMappings.find(
        (m) => m.path === country || m.country.toLowerCase().replace(/ /g, '-') === country
    )

    return {
        ...metadataHelper({
            title: `${t(i18n.sendMoneyTo, { country: countryName })} | Peanut`,
            description: t(i18n.sendMoneyToSubtitle, {
                country: countryName,
                currency: mapping?.currencyCode ?? '',
            }),
            canonical: `/${locale}/send-money-to/${country}`,
        }),
        alternates: {
            canonical: `/${locale}/send-money-to/${country}`,
            languages: getAlternates('send-money-to', country),
        },
    }
}

export default async function SendMoneyToCountryPageLocalized({ params }: PageProps) {
    const { locale, country } = await params
    if (!isValidLocale(locale)) notFound()

    return <CorridorPageContent country={country} locale={locale} />
}
