import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { DestinationGrid } from '@/components/Marketing/DestinationGrid'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations } from '@/i18n'

interface PageProps {
    params: Promise<{ locale: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params
    if (!isValidLocale(locale)) return {}

    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${i18n.sendMoney} | Peanut`,
            description: i18n.sendMoneyToSubtitle.replace('{country}', '').replace('{currency}', '').trim(),
            canonical: `/${locale}/send-money-to`,
        }),
        alternates: {
            canonical: `/${locale}/send-money-to`,
            languages: getAlternates('send-money-to'),
        },
    }
}

export default async function SendMoneyToIndexPageLocalized({ params }: PageProps) {
    const { locale } = await params
    if (!isValidLocale(locale)) notFound()

    const i18n = getTranslations(locale as Locale)

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: i18n.home, item: 'https://peanut.me' },
            {
                '@type': 'ListItem',
                position: 2,
                name: i18n.sendMoney,
                item: `https://peanut.me/${locale}/send-money-to`,
            },
        ],
    }

    return (
        <>
            <JsonLd data={breadcrumbSchema} />
            <MarketingHero
                title={i18n.sendMoney}
                subtitle={i18n.sendMoneyToOtherCountries}
            />
            <MarketingShell>
                <DestinationGrid title={i18n.sendMoneyToOtherCountries} locale={locale as Locale} />
            </MarketingShell>
        </>
    )
}
