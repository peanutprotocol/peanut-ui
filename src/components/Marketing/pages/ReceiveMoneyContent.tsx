import Link from 'next/link'
import { getFlagUrl, findMappingBySlug } from '@/constants/countryCurrencyMapping'
import { CORRIDORS, getCountryName, getLocalizedSEO } from '@/data/seo'
import { getTranslations, t, localizedPath, localizedBarePath } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Section } from '@/components/Marketing/Section'
import { Steps } from '@/components/Marketing/Steps'
import { FAQSection } from '@/components/Marketing/FAQSection'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { RelatedPages } from '@/components/Marketing/RelatedPages'
import { Card } from '@/components/0_Bruddle/Card'

interface ReceiveMoneyContentProps {
    sourceCountry: string
    locale: Locale
}

export function ReceiveMoneyContent({ sourceCountry, locale }: ReceiveMoneyContentProps) {
    const i18n = getTranslations(locale)
    const sourceName = getCountryName(sourceCountry, locale)
    const sourceSeo = getLocalizedSEO(sourceCountry, locale)

    // Destinations that receive money from this source
    const destinations = CORRIDORS.filter((c) => c.from === sourceCountry).map((c) => c.to)

    const sourceMapping = findMappingBySlug(sourceCountry)

    const howToSteps = [
        {
            title: t(i18n.stepCreateAccount),
            description: t(i18n.stepCreateAccountDesc),
        },
        {
            title: t(i18n.stepDepositFunds),
            description: t(i18n.stepDepositFundsDesc, { method: sourceSeo?.instantPayment ?? '' }),
        },
        {
            title: i18n.sendMoney,
            description: t(i18n.receiveMoneyFromDesc, { country: sourceName }),
        },
    ]

    const baseUrl = 'https://peanut.me'

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: i18n.home, item: baseUrl },
            {
                '@type': 'ListItem',
                position: 2,
                name: t(i18n.receiveMoneyFrom, { country: sourceName }),
                item: `${baseUrl}/${locale}/receive-money-from/${sourceCountry}`,
            },
        ],
    }

    const faqs = sourceSeo?.faqs ?? []

    // Related pages for internal linking
    const relatedPages = [
        {
            title: t(i18n.hubTitle, { country: sourceName }),
            href: localizedBarePath(locale, sourceCountry),
        },
        {
            title: t(i18n.sendMoneyTo, { country: sourceName }),
            href: localizedPath('send-money-to', locale, sourceCountry),
        },
    ]

    // Add from-to corridor links for each destination
    for (const dest of destinations.slice(0, 3)) {
        const destName = getCountryName(dest, locale)
        relatedPages.push({
            title: t(i18n.sendMoneyFromTo, { from: sourceName, to: destName }),
            href: localizedPath('send-money-from', locale, `${sourceCountry}/to/${dest}`),
        })
    }

    const today = new Date().toISOString().split('T')[0]

    return (
        <>
            <JsonLd data={breadcrumbSchema} />

            <MarketingHero
                title={t(i18n.receiveMoneyFrom, { country: sourceName })}
                subtitle={t(i18n.receiveMoneyFromDesc, { country: sourceName })}
            />

            <MarketingShell>
                {/* Destination countries grid */}
                <Section title={t(i18n.receiveMoneyFrom, { country: sourceName })}>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                        {destinations.map((destSlug) => {
                            const destName = getCountryName(destSlug, locale)
                            const destMapping = findMappingBySlug(destSlug)
                            return (
                                <Link
                                    key={destSlug}
                                    href={localizedPath('send-money-from', locale, `${sourceCountry}/to/${destSlug}`)}
                                >
                                    <Card className="flex-row items-center gap-2 p-3 transition-all hover:shadow-4 hover:-translate-x-1 hover:-translate-y-1">
                                        {destMapping?.flagCode && (
                                            <img
                                                src={getFlagUrl(destMapping.flagCode)}
                                                alt={`${destName} flag`}
                                                width={24}
                                                height={18}
                                                className="rounded-sm"
                                            />
                                        )}
                                        <span className="text-sm font-medium">
                                            {sourceName} → {destName}
                                        </span>
                                    </Card>
                                </Link>
                            )
                        })}
                    </div>
                </Section>

                {/* How it works */}
                <Section title={i18n.howItWorks}>
                    <Steps steps={howToSteps} />
                </Section>

                {/* FAQs */}
                {faqs.length > 0 && <FAQSection faqs={faqs} title={i18n.frequentlyAskedQuestions} />}

                {/* Related pages */}
                <RelatedPages pages={relatedPages} title={i18n.relatedPages} />

                {/* Last updated */}
                <p className="py-4 text-xs text-gray-400">{t(i18n.lastUpdated, { date: today })}</p>
            </MarketingShell>
        </>
    )
}
