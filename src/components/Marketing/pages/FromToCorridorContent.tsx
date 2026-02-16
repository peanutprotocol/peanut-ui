import Link from 'next/link'
import { getFlagUrl, findMappingBySlug } from '@/constants/countryCurrencyMapping'
import { COUNTRIES_SEO, getLocalizedSEO, getCountryName, CORRIDORS } from '@/data/seo'
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

interface FromToCorridorContentProps {
    from: string
    to: string
    locale: Locale
}

export function FromToCorridorContent({ from, to, locale }: FromToCorridorContentProps) {
    const i18n = getTranslations(locale)
    const fromName = getCountryName(from, locale)
    const toName = getCountryName(to, locale)

    const toSeo = getLocalizedSEO(to, locale)
    const fromSeo = getLocalizedSEO(from, locale)

    const fromMapping = findMappingBySlug(from)
    const toMapping = findMappingBySlug(to)

    const fromCurrency = fromMapping?.currencyCode ?? ''
    const toCurrency = toMapping?.currencyCode ?? ''

    const howToSteps = [
        {
            title: t(i18n.stepCreateAccount),
            description: t(i18n.stepCreateAccountDesc),
        },
        {
            title: t(i18n.stepDepositFunds),
            description: t(i18n.stepDepositFundsDesc, { method: fromSeo?.instantPayment ?? '' }),
        },
        {
            title: t(i18n.stepSendTo, { country: toName }),
            description: t(i18n.stepSendToDesc, {
                currency: toCurrency || 'local currency',
                method: toSeo?.instantPayment ?? 'bank transfer',
            }),
        },
    ]

    const baseUrl = 'https://peanut.me'
    const canonicalPath = `/${locale}/send-money-from/${from}/to/${to}`

    const howToSchema = {
        '@context': 'https://schema.org',
        '@type': 'HowTo',
        name: t(i18n.sendMoneyFromTo, { from: fromName, to: toName }),
        description: t(i18n.sendMoneyFromToDesc, { from: fromName, to: toName }),
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
                name: fromName,
                item: `${baseUrl}${localizedBarePath(locale, from)}`,
            },
            {
                '@type': 'ListItem',
                position: 3,
                name: t(i18n.sendMoneyFromTo, { from: fromName, to: toName }),
                item: `${baseUrl}${canonicalPath}`,
            },
        ],
    }

    // Build FAQ from destination country FAQs
    const faqs = toSeo?.faqs ?? []

    // Related corridors from the same origin
    const relatedFromSame = CORRIDORS.filter((c) => c.from === from && c.to !== to).slice(0, 6)

    // Related pages for internal linking
    const relatedPages = [
        {
            title: t(i18n.hubTitle, { country: fromName }),
            href: localizedBarePath(locale, from),
        },
        {
            title: t(i18n.hubTitle, { country: toName }),
            href: localizedBarePath(locale, to),
        },
        {
            title: t(i18n.sendMoneyTo, { country: toName }),
            href: localizedPath('send-money-to', locale, to),
        },
    ]

    if (toCurrency) {
        relatedPages.push({
            title: t(i18n.convertTitle, { from: fromCurrency || 'USD', to: toCurrency }),
            href: localizedPath('convert', locale, `${(fromCurrency || 'usd').toLowerCase()}-to-${toCurrency.toLowerCase()}`),
        })
    }

    const today = new Date().toISOString().split('T')[0]

    return (
        <>
            <JsonLd data={howToSchema} />
            <JsonLd data={breadcrumbSchema} />

            <MarketingHero
                title={t(i18n.sendMoneyFromTo, { from: fromName, to: toName })}
                subtitle={t(i18n.sendMoneyFromToDesc, { from: fromName, to: toName })}
            />

            <MarketingShell>
                {/* Route summary card */}
                <section className="py-8">
                    <Card className="flex-row items-center justify-between gap-4 p-5">
                        <div className="flex items-center gap-3">
                            {fromMapping?.flagCode && (
                                <img
                                    src={getFlagUrl(fromMapping.flagCode, 320)}
                                    alt={`${fromName} flag`}
                                    width={48}
                                    height={36}
                                    className="rounded-sm border border-n-1/20"
                                />
                            )}
                            <div>
                                <span className="text-sm text-gray-500">{i18n.sendMoney}</span>
                                <p className="font-semibold">{fromName}</p>
                                {fromCurrency && <span className="text-xs text-gray-400">{fromCurrency}</span>}
                            </div>
                        </div>
                        <span className="text-2xl text-gray-400">→</span>
                        <div className="flex items-center gap-3">
                            {toMapping?.flagCode && (
                                <img
                                    src={getFlagUrl(toMapping.flagCode, 320)}
                                    alt={`${toName} flag`}
                                    width={48}
                                    height={36}
                                    className="rounded-sm border border-n-1/20"
                                />
                            )}
                            <div>
                                <span className="text-sm text-gray-500">{t(i18n.receiveMoneyFrom, { country: '' }).trim()}</span>
                                <p className="font-semibold">{toName}</p>
                                {toCurrency && <span className="text-xs text-gray-400">{toCurrency}</span>}
                            </div>
                        </div>
                    </Card>
                </section>

                {/* Context paragraph */}
                <Section title={t(i18n.sendMoneyFromTo, { from: fromName, to: toName })}>
                    <p className="text-gray-700">
                        {t(i18n.fromToContext, { from: fromName, to: toName })}
                    </p>
                    {toSeo?.context && (
                        <p className="mt-3 text-gray-700">{toSeo.context}</p>
                    )}
                </Section>

                {/* How it works */}
                <Section title={i18n.howItWorks}>
                    <Steps steps={howToSteps} />
                </Section>

                {/* Payment methods */}
                {(toSeo?.instantPayment || fromSeo?.instantPayment) && (
                    <Section title={i18n.paymentMethods}>
                        <div className="flex flex-col gap-3">
                            {fromSeo?.instantPayment && (
                                <Card className="p-4">
                                    <h3 className="font-semibold">{fromSeo.instantPayment} ({fromName})</h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {t(i18n.instantDeposits, { method: fromSeo.instantPayment, country: fromName })}
                                    </p>
                                </Card>
                            )}
                            {toSeo?.instantPayment && (
                                <Card className="p-4">
                                    <h3 className="font-semibold">{toSeo.instantPayment} ({toName})</h3>
                                    <p className="mt-1 text-sm text-gray-600">
                                        {t(i18n.instantDeposits, { method: toSeo.instantPayment, country: toName })}
                                    </p>
                                </Card>
                            )}
                            <Card className="p-4">
                                <h3 className="font-semibold">{i18n.stablecoins}</h3>
                                <p className="mt-1 text-sm text-gray-600">
                                    {t(i18n.stablecoinsDesc, { currency: toCurrency || 'local currency' })}
                                </p>
                            </Card>
                        </div>
                    </Section>
                )}

                {/* Other corridors from same origin */}
                {relatedFromSame.length > 0 && (
                    <Section title={t(i18n.hubSendMoneyFrom, { country: fromName })}>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {relatedFromSame.map((c) => {
                                const destName = getCountryName(c.to, locale)
                                const destMapping = findMappingBySlug(c.to)
                                return (
                                    <Link
                                        key={c.to}
                                        href={localizedPath('send-money-from', locale, `${c.from}/to/${c.to}`)}
                                    >
                                        <Card className="flex-row items-center gap-2 p-3 transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-4">
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
                                                {fromName} → {destName}
                                            </span>
                                        </Card>
                                    </Link>
                                )
                            })}
                        </div>
                    </Section>
                )}

                {/* FAQs */}
                {faqs.length > 0 && <FAQSection faqs={faqs} title={i18n.frequentlyAskedQuestions} />}

                {/* Related pages */}
                <RelatedPages pages={relatedPages} title={i18n.relatedPages} />

                {/* Last updated */}
                <p className="py-4 text-xs text-gray-400">
                    {t(i18n.lastUpdated, { date: today })}
                </p>
            </MarketingShell>
        </>
    )
}
