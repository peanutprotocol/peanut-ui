import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { COUNTRIES_SEO, CORRIDORS, getCountryName } from '@/data/seo'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t } from '@/i18n'
import { FromToCorridorContent } from '@/components/Marketing/pages/FromToCorridorContent'
import countryCurrencyMappings from '@/constants/countryCurrencyMapping'

interface PageProps {
    params: Promise<{ locale: string; from: string; to: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) =>
        CORRIDORS.map((c) => ({ locale, from: c.from, to: c.to }))
    )
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, from, to } = await params
    if (!isValidLocale(locale)) return {}

    if (!CORRIDORS.some((c) => c.from === from && c.to === to)) return {}

    const i18n = getTranslations(locale as Locale)
    const fromName = getCountryName(from, locale as Locale)
    const toName = getCountryName(to, locale as Locale)

    const toMapping = countryCurrencyMappings.find(
        (m) => m.path === to || m.country.toLowerCase().replace(/ /g, '-') === to
    )

    return {
        ...metadataHelper({
            title: `${t(i18n.sendMoneyFromTo, { from: fromName, to: toName })} | Peanut`,
            description: t(i18n.sendMoneyFromToDesc, { from: fromName, to: toName }),
            canonical: `/${locale}/send-money-from/${from}/to/${to}`,
        }),
        alternates: {
            canonical: `/${locale}/send-money-from/${from}/to/${to}`,
            languages: getAlternates('send-money-from', `${from}/to/${to}`),
        },
    }
}

export default async function FromToCorridorPage({ params }: PageProps) {
    const { locale, from, to } = await params
    if (!isValidLocale(locale)) notFound()
    if (!CORRIDORS.some((c) => c.from === from && c.to === to)) notFound()

    return <FromToCorridorContent from={from} to={to} locale={locale as Locale} />
}
