import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { CONVERT_PAIRS, CURRENCY_DISPLAY, parseConvertPair } from '@/data/seo'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Section } from '@/components/Marketing/Section'
import { FAQSection } from '@/components/Marketing/FAQSection'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Card } from '@/components/0_Bruddle/Card'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t } from '@/i18n'

export const revalidate = 300

interface PageProps {
    params: Promise<{ locale: string; pair: string }>
}

export async function generateStaticParams() {
    return SUPPORTED_LOCALES.flatMap((locale) => CONVERT_PAIRS.map((pair) => ({ locale, pair })))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, pair } = await params
    if (!isValidLocale(locale)) return {}

    const parsed = parseConvertPair(pair)
    if (!parsed) return {}
    const fromDisplay = CURRENCY_DISPLAY[parsed.from]
    const toDisplay = CURRENCY_DISPLAY[parsed.to]
    if (!fromDisplay || !toDisplay) return {}

    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${t(i18n.convertTitle, { from: parsed.from.toUpperCase(), to: parsed.to.toUpperCase() })} | Peanut`,
            description: `${t(i18n.convertTitle, { from: fromDisplay.name, to: toDisplay.name })}`,
            canonical: `/${locale}/convert/${pair}`,
        }),
        alternates: {
            canonical: `/${locale}/convert/${pair}`,
            languages: getAlternates('convert', pair),
        },
    }
}

export default async function ConvertPairPageLocalized({ params }: PageProps) {
    const { locale, pair } = await params
    if (!isValidLocale(locale)) notFound()

    const parsed = parseConvertPair(pair)
    if (!parsed || !(CONVERT_PAIRS as readonly string[]).includes(pair)) notFound()

    const fromDisplay = CURRENCY_DISPLAY[parsed.from]
    const toDisplay = CURRENCY_DISPLAY[parsed.to]
    if (!fromDisplay || !toDisplay) notFound()

    const i18n = getTranslations(locale as Locale)
    const fromCode = parsed.from.toUpperCase()
    const toCode = parsed.to.toUpperCase()
    const conversionAmounts = [10, 50, 100, 250, 500, 1000]

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: i18n.home, item: 'https://peanut.me' },
            {
                '@type': 'ListItem',
                position: 2,
                name: t(i18n.convertTitle, { from: fromCode, to: toCode }),
                item: `https://peanut.me/${locale}/convert/${pair}`,
            },
        ],
    }

    const faqs = [
        {
            q: t(i18n.convertTitle, { from: fromCode, to: toCode }) + '?',
            a: `Peanut — ${t(i18n.convertTitle, { from: fromDisplay.name, to: toDisplay.name })}`,
        },
    ]

    return (
        <>
            <JsonLd data={breadcrumbSchema} />

            <MarketingHero
                title={`${fromCode} → ${toCode}`}
                subtitle={t(i18n.convertTitle, { from: fromDisplay.name, to: toDisplay.name })}
            />

            <MarketingShell>
                <Section title={i18n.liveRate}>
                    <Card className="overflow-hidden">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-n-1 bg-primary-1/20">
                                    <th className="px-4 py-3 font-semibold">{fromCode}</th>
                                    <th className="px-4 py-3 font-semibold">{toCode}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {conversionAmounts.map((amount, i) => (
                                    <tr key={amount} className={i % 2 === 1 ? 'bg-primary-3/30' : ''}>
                                        <td className="border-b border-n-1/20 px-4 py-3 font-medium">
                                            {fromDisplay.symbol}
                                            {amount.toLocaleString()}
                                        </td>
                                        <td className="border-b border-n-1/20 px-4 py-3 text-gray-600">
                                            {i18n.liveRate}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Card>
                </Section>

                <Section title={i18n.howItWorks}>
                    <ol className="flex list-inside list-decimal flex-col gap-2 text-gray-700">
                        <li>{i18n.stepCreateAccountDesc}</li>
                        <li>{t(i18n.stepDepositFundsDesc, { method: '' })}</li>
                        <li>{t(i18n.stepSendToDesc, { currency: toDisplay.name, method: '' })}</li>
                    </ol>
                </Section>

                {/* TODO (marketer): Add 300+ words of editorial content per currency pair to avoid
                    thin content flags. Include: currency background, exchange rate trends,
                    tips for getting best rates, common use cases. See Wise convert pages for reference. */}

                <FAQSection faqs={faqs} />
            </MarketingShell>
        </>
    )
}
