import { notFound } from 'next/navigation'
import { getFlagUrl, findMappingBySlug } from '@/constants/countryCurrencyMapping'
import { COUNTRIES_SEO, getLocalizedSEO, getCountryName } from '@/data/seo'
import { getTranslations, t, localizedPath, localizedBarePath } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Section } from '@/components/Marketing/Section'
import { Steps } from '@/components/Marketing/Steps'
import { FAQSection } from '@/components/Marketing/FAQSection'
import { DestinationGrid } from '@/components/Marketing/DestinationGrid'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { RelatedPages } from '@/components/Marketing/RelatedPages'

interface CorridorPageContentProps {
    country: string
    locale: Locale
}

export function CorridorPageContent({ country, locale }: CorridorPageContentProps) {
    const seo = getLocalizedSEO(country, locale)
    if (!seo) notFound()

    const i18n = getTranslations(locale)
    const countryName = getCountryName(country, locale)

    const mapping = findMappingBySlug(country)
    const currencyCode = mapping?.currencyCode ?? ''
    const flagCode = mapping?.flagCode

    const howToSteps = [
        {
            title: t(i18n.stepCreateAccount),
            description: t(i18n.stepCreateAccountDesc),
        },
        {
            title: t(i18n.stepDepositFunds),
            description: t(i18n.stepDepositFundsDesc, { method: seo.instantPayment ?? '' }),
        },
        {
            title: t(i18n.stepSendTo, { country: countryName }),
            description: t(i18n.stepSendToDesc, {
                currency: currencyCode || 'local currency',
                method: seo.instantPayment ?? 'bank transfer',
            }),
        },
    ]

    const baseUrl = 'https://peanut.me'
    const canonicalPath = localizedPath('send-money-to', locale, country)

    const howToSchema = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: t(i18n.sendMoneyTo, { country: countryName }),
        description: t(i18n.sendMoneyToSubtitle, { country: countryName, currency: currencyCode }),
        inLanguage: locale,
        step: howToSteps.map((step, i) => ({
            '@type': 'HowToStep',
            position: i + 1,
            name: step.title,
            text: step.description,
        })),
    }

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: i18n.home, item: baseUrl },
            {
                '@type': 'ListItem',
                position: 2,
                name: i18n.sendMoney,
                item: `${baseUrl}${localizedPath('send-money-to', locale)}`,
            },
            { '@type': 'ListItem', position: 3, name: countryName, item: `${baseUrl}${canonicalPath}` },
        ],
    }

    const otherCountries = Object.keys(COUNTRIES_SEO).filter((c) => c !== country)

    return (
        <>
            <JsonLd data={howToSchema} />
            <JsonLd data={breadcrumbSchema} />

            <MarketingHero
                title={t(i18n.sendMoneyTo, { country: countryName })}
                subtitle={t(i18n.sendMoneyToSubtitle, { country: countryName, currency: currencyCode })}
            />

            <MarketingShell>
                <Section title={t(i18n.sendingMoneyTo, { country: countryName })}>
                    <div className="flex items-start gap-4">
                        {flagCode && (
                            <img
                                src={getFlagUrl(flagCode, 320)}
                                alt={`${countryName} flag`}
                                width={64}
                                height={48}
                                className="mt-1 rounded-sm border border-n-1/20"
                            />
                        )}
                        <p className="text-gray-700">{seo.context}</p>
                    </div>
                </Section>

                <Section title={i18n.howItWorks}>
                    <Steps steps={howToSteps} />
                </Section>

                {seo.instantPayment && (
                    <Section title={i18n.paymentMethods}>
                        <div className="flex flex-col gap-3">
                            <div className="rounded-sm border border-n-1 bg-primary-1/10 p-4">
                                <h3 className="font-semibold">{seo.instantPayment}</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    {t(i18n.instantDeposits, { method: seo.instantPayment, country: countryName })}
                                    {seo.payMerchants && ` ${i18n.qrPayments}`}
                                </p>
                            </div>
                            <div className="rounded-sm border border-n-1 p-4">
                                <h3 className="font-semibold">{i18n.stablecoins}</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    {t(i18n.stablecoinsDesc, { currency: currencyCode || 'local currency' })}
                                </p>
                            </div>
                            <div className="rounded-sm border border-n-1 p-4">
                                <h3 className="font-semibold">{i18n.bankTransfer}</h3>
                                <p className="mt-1 text-sm text-gray-600">{i18n.bankTransferDesc}</p>
                            </div>
                        </div>
                    </Section>
                )}

                {seo.faqs.length > 0 && <FAQSection faqs={seo.faqs} />}

                {/* Related pages */}
                <RelatedPages
                    title={i18n.relatedPages}
                    pages={[
                        {
                            title: t(i18n.hubTitle, { country: countryName }),
                            href: localizedBarePath(locale, country),
                        },
                        ...(currencyCode
                            ? [
                                  {
                                      title: t(i18n.convertTitle, { from: 'USD', to: currencyCode }),
                                      href: localizedPath('convert', locale, `usd-to-${currencyCode.toLowerCase()}`),
                                  },
                              ]
                            : []),
                        {
                            title: t(i18n.receiveMoneyFrom, { country: countryName }),
                            href: localizedPath('receive-money-from', locale, country),
                        },
                    ]}
                />

                <DestinationGrid countries={otherCountries} title={i18n.sendMoneyToOtherCountries} locale={locale} />

                {/* Last updated */}
                <p className="py-4 text-xs text-gray-400">
                    {t(i18n.lastUpdated, { date: new Date().toISOString().split('T')[0] })}
                </p>
            </MarketingShell>
        </>
    )
}
