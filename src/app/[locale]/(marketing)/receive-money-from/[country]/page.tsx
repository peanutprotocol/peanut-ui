import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { CORRIDORS, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t } from '@/i18n'
import { ReceiveMoneyContent } from '@/components/Marketing/pages/ReceiveMoneyContent'

interface PageProps {
    params: Promise<{ locale: string; country: string }>
}

/** Unique sending countries */
function getReceiveSources(): string[] {
    return [...new Set(CORRIDORS.map((c) => c.from))]
}

export async function generateStaticParams() {
    const sources = getReceiveSources()
    return SUPPORTED_LOCALES.flatMap((locale) => sources.map((country) => ({ locale, country })))
}
export const dynamicParams = false

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, country } = await params
    if (!isValidLocale(locale)) return {}
    if (!getReceiveSources().includes(country)) return {}

    const i18n = getTranslations(locale as Locale)
    const countryName = getCountryName(country, locale as Locale)

    return {
        ...metadataHelper({
            title: `${t(i18n.receiveMoneyFrom, { country: countryName })} | Peanut`,
            description: t(i18n.receiveMoneyFromDesc, { country: countryName }),
            canonical: `/${locale}/receive-money-from/${country}`,
        }),
        alternates: {
            canonical: `/${locale}/receive-money-from/${country}`,
            languages: getAlternates('receive-money-from', country),
        },
    }
}

export default async function ReceiveMoneyPage({ params }: PageProps) {
    const { locale, country } = await params
    if (!isValidLocale(locale)) notFound()
    if (!getReceiveSources().includes(country)) notFound()

    return <ReceiveMoneyContent sourceCountry={country} locale={locale as Locale} />
}
