import { notFound } from 'next/navigation'
import { type Metadata } from 'next'
import { generateMetadata as metadataHelper } from '@/app/metadata'
import { EXCHANGES } from '@/data/seo'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Section } from '@/components/Marketing/Section'
import { Steps } from '@/components/Marketing/Steps'
import { FAQSection } from '@/components/Marketing/FAQSection'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Card } from '@/components/0_Bruddle/Card'
import { SUPPORTED_LOCALES, getAlternates, isValidLocale } from '@/i18n/config'
import type { Locale } from '@/i18n/types'
import { getTranslations, t, localizedPath } from '@/i18n'
import { RelatedPages } from '@/components/Marketing/RelatedPages'

interface PageProps {
    params: Promise<{ locale: string; exchange: string }>
}

export async function generateStaticParams() {
    const exchanges = Object.keys(EXCHANGES)
    return SUPPORTED_LOCALES.flatMap((locale) => exchanges.map((exchange) => ({ locale, exchange: `from-${exchange}` })))
}

/** Strip the "from-" URL prefix to get the data key. Returns null if prefix missing. */
function parseExchange(raw: string): string | null {
    if (!raw.startsWith('from-')) return null
    return raw.slice('from-'.length)
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale, exchange: rawExchange } = await params
    if (!isValidLocale(locale)) return {}

    const exchange = parseExchange(rawExchange)
    if (!exchange) return {}
    const ex = EXCHANGES[exchange]
    if (!ex) return {}

    const i18n = getTranslations(locale as Locale)

    return {
        ...metadataHelper({
            title: `${t(i18n.depositFrom, { exchange: ex.name })} | Peanut`,
            description: `${t(i18n.depositFrom, { exchange: ex.name })}. ${i18n.recommendedNetwork}: ${ex.recommendedNetwork}.`,
            canonical: `/${locale}/deposit/from-${exchange}`,
        }),
        alternates: {
            canonical: `/${locale}/deposit/from-${exchange}`,
            languages: getAlternates('deposit', `from-${exchange}`),
        },
    }
}

export default async function DepositPageLocalized({ params }: PageProps) {
    const { locale, exchange: rawExchange } = await params
    if (!isValidLocale(locale)) notFound()

    const exchange = parseExchange(rawExchange)
    if (!exchange) notFound()
    const ex = EXCHANGES[exchange]
    if (!ex) notFound()

    const i18n = getTranslations(locale as Locale)

    const steps = ex.steps.map((step, i) => ({
        title: `${i + 1}`,
        description: step,
    }))

    const howToSchema = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: t(i18n.depositFrom, { exchange: ex.name }),
        inLanguage: locale,
        step: steps.map((step, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: step.title,
            text: step.description,
        })),
    }

    return (
        <>
            <JsonLd data={howToSchema} />

            <MarketingHero
                title={t(i18n.depositFrom, { exchange: ex.name })}
                subtitle={`${ex.processingTime} · ${ex.recommendedNetwork}`}
                image={ex.image}
            />

            <MarketingShell>
                <Section title={i18n.howItWorks}>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {[
                            { label: i18n.recommendedNetwork, value: ex.recommendedNetwork },
                            { label: i18n.withdrawalFee, value: ex.withdrawalFee },
                            { label: i18n.processingTime, value: ex.processingTime },
                        ].map((item) => (
                            <Card key={item.label} className="p-3 text-center">
                                <span className="text-xs text-gray-500">{item.label}</span>
                                <span className="mt-1 block text-sm font-bold">{item.value}</span>
                            </Card>
                        ))}
                    </div>
                </Section>

                <Section title={t(i18n.depositFrom, { exchange: ex.name })}>
                    <Steps steps={steps} />
                </Section>

                {ex.troubleshooting.length > 0 && (
                    <Section title={i18n.troubleshooting}>
                        <div className="flex flex-col gap-3">
                            {ex.troubleshooting.map((item, i) => (
                                <Card key={i} className="p-4">
                                    <h3 className="font-semibold text-red-700">{item.issue}</h3>
                                    <p className="mt-1 text-sm text-gray-600">{item.fix}</p>
                                </Card>
                            ))}
                        </div>
                    </Section>
                )}

                <FAQSection faqs={ex.faqs} />

                {/* Related deposit guides */}
                <RelatedPages
                    title={i18n.relatedPages}
                    pages={Object.entries(EXCHANGES)
                        .filter(([slug]) => slug !== exchange)
                        .slice(0, 5)
                        .map(([slug, e]) => ({
                            title: t(i18n.depositFrom, { exchange: e.name }),
                            href: localizedPath('deposit', locale, `from-${slug}`),
                        }))}
                />

                {/* Last updated */}
                <p className="py-4 text-xs text-gray-400">
                    {t(i18n.lastUpdated, { date: new Date().toISOString().split('T')[0] })}
                </p>
            </MarketingShell>
        </>
    )
}
