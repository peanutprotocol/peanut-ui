import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getFlagUrl, findMappingBySlug } from '@/constants/countryCurrencyMapping'
import { COUNTRIES_SEO, getLocalizedSEO, getCountryName, CORRIDORS, COMPETITORS, EXCHANGES } from '@/data/seo'
import { getTranslations, t, localizedPath } from '@/i18n'
import type { Locale } from '@/i18n/types'
import { MarketingHero } from '@/components/Marketing/MarketingHero'
import { MarketingShell } from '@/components/Marketing/MarketingShell'
import { Section } from '@/components/Marketing/Section'
import { FAQSection } from '@/components/Marketing/FAQSection'
import { DestinationGrid } from '@/components/Marketing/DestinationGrid'
import { JsonLd } from '@/components/Marketing/JsonLd'
import { Card } from '@/components/0_Bruddle/Card'

interface HubPageContentProps {
    country: string
    locale: Locale
}

interface HubLink {
    title: string
    description: string
    href: string
    emoji: string
}

export function HubPageContent({ country, locale }: HubPageContentProps) {
    const seo = getLocalizedSEO(country, locale)
    if (!seo) notFound()

    const i18n = getTranslations(locale)
    const countryName = getCountryName(country, locale)

    const mapping = findMappingBySlug(country)
    const currencyCode = mapping?.currencyCode ?? ''
    const flagCode = mapping?.flagCode

    // Build hub spoke links
    const links: HubLink[] = []

    // 1. Send money corridor
    links.push({
        title: t(i18n.hubSendMoney, { country: countryName }),
        description: t(i18n.hubSendMoneyDesc, { country: countryName }),
        href: localizedPath('send-money-to', locale, country),
        emoji: '💸',
    })

    // 2. Convert pages (relevant currency pairs)
    if (currencyCode) {
        const lowerCurrency = currencyCode.toLowerCase()
        links.push({
            title: t(i18n.hubConvert, { currency: currencyCode }),
            description: t(i18n.hubConvertDesc),
            href: localizedPath('convert', locale, `usd-to-${lowerCurrency}`),
            emoji: '💱',
        })
    }

    // 3. Deposit pages (related exchanges from country seo)
    const relatedExchanges = Object.keys(EXCHANGES).slice(0, 3) // Top 3 exchanges
    if (relatedExchanges.length > 0) {
        links.push({
            title: t(i18n.hubDeposit),
            description: t(i18n.hubDepositDesc),
            href: localizedPath('deposit', locale, `from-${relatedExchanges[0]}`),
            emoji: '🏦',
        })
    }

    // 4. Compare pages (if relevant competitors exist)
    const competitorSlugs = Object.keys(COMPETITORS).filter(
        (slug) => !['mercado-pago', 'pix', 'dolar-mep', 'cueva'].includes(slug)
    )
    if (competitorSlugs.length > 0) {
        links.push({
            title: t(i18n.hubCompare),
            description: t(i18n.hubCompareDesc),
            href: localizedPath('compare', locale, `peanut-vs-${competitorSlugs[0]}`),
            emoji: '⚖️',
        })
    }

    // Inbound corridors: countries that send money TO this country
    const inboundCorridors = CORRIDORS.filter((c) => c.to === country).map((c) => c.from)

    // Outbound corridors: countries this country sends money TO
    const outboundCorridors = CORRIDORS.filter((c) => c.from === country).map((c) => c.to)

    // Other countries for the grid
    const otherCountries = Object.keys(COUNTRIES_SEO).filter((c) => c !== country)

    const baseUrl = 'https://peanut.me'

    const breadcrumbSchema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
            { '@type': 'ListItem', position: 1, name: i18n.home, item: baseUrl },
            {
                '@type': 'ListItem',
                position: 2,
                name: countryName,
                item: `${baseUrl}/${locale}/${country}`,
            },
        ],
    }

    const webPageSchema = {
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: t(i18n.hubTitle, { country: countryName }),
        description: t(i18n.hubSubtitle, { country: countryName }),
        inLanguage: locale,
        url: `${baseUrl}/${locale}/${country}`,
    }

    return (
        <>
            <JsonLd data={breadcrumbSchema} />
            <JsonLd data={webPageSchema} />

            <MarketingHero
                title={t(i18n.hubTitle, { country: countryName })}
                subtitle={t(i18n.hubSubtitle, { country: countryName })}
            />

            <MarketingShell>
                {/* Country context */}
                <Section title={countryName}>
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

                {/* Hub spoke links grid */}
                <section className="py-8">
                    <div className="grid gap-4 md:grid-cols-2">
                        {links.map((link) => (
                            <Link key={link.href} href={link.href}>
                                <Card className="h-full gap-2 p-5 transition-all hover:shadow-4 hover:-translate-x-1 hover:-translate-y-1">
                                    <span className="text-2xl">{link.emoji}</span>
                                    <h3 className="text-lg font-semibold">{link.title}</h3>
                                    <p className="text-sm text-gray-600">{link.description}</p>
                                </Card>
                            </Link>
                        ))}
                    </div>
                </section>

                {/* Inbound corridors */}
                {inboundCorridors.length > 0 && (
                    <Section title={t(i18n.sendMoneyTo, { country: countryName })}>
                        <p className="mb-4 text-sm text-gray-600">
                            {t(i18n.hubInboundCorridors, { country: countryName })}
                        </p>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {inboundCorridors.map((fromSlug) => {
                                const fromName = getCountryName(fromSlug, locale)
                                const fromMapping = findMappingBySlug(fromSlug)
                                return (
                                    <Link
                                        key={fromSlug}
                                        href={localizedPath('send-money-from', locale, `${fromSlug}/to/${country}`)}
                                    >
                                        <Card className="flex-row items-center gap-2 p-3 transition-all hover:shadow-4 hover:-translate-x-1 hover:-translate-y-1">
                                            {fromMapping?.flagCode && (
                                                <img
                                                    src={getFlagUrl(fromMapping.flagCode)}
                                                    alt={`${fromName} flag`}
                                                    width={24}
                                                    height={18}
                                                    className="rounded-sm"
                                                />
                                            )}
                                            <span className="text-sm font-medium">
                                                {fromName} → {countryName}
                                            </span>
                                        </Card>
                                    </Link>
                                )
                            })}
                        </div>
                    </Section>
                )}

                {/* Outbound corridors */}
                {outboundCorridors.length > 0 && (
                    <Section title={t(i18n.hubSendMoneyFrom, { country: countryName })}>
                        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
                            {outboundCorridors.map((toSlug) => {
                                const toName = getCountryName(toSlug, locale)
                                const toMapping = findMappingBySlug(toSlug)
                                return (
                                    <Link
                                        key={toSlug}
                                        href={localizedPath('send-money-from', locale, `${country}/to/${toSlug}`)}
                                    >
                                        <Card className="flex-row items-center gap-2 p-3 transition-all hover:shadow-4 hover:-translate-x-1 hover:-translate-y-1">
                                            {toMapping?.flagCode && (
                                                <img
                                                    src={getFlagUrl(toMapping.flagCode)}
                                                    alt={`${toName} flag`}
                                                    width={24}
                                                    height={18}
                                                    className="rounded-sm"
                                                />
                                            )}
                                            <span className="text-sm font-medium">
                                                {countryName} → {toName}
                                            </span>
                                        </Card>
                                    </Link>
                                )
                            })}
                        </div>
                    </Section>
                )}

                {/* Instant payment highlight */}
                {seo.instantPayment && (
                    <Section title={seo.instantPayment}>
                        <Card className="gap-2 bg-primary-3/20 p-5">
                            <p className="text-gray-700">
                                {t(i18n.instantDeposits, {
                                    method: seo.instantPayment,
                                    country: countryName,
                                })}
                            </p>
                            {seo.payMerchants && <p className="text-sm text-gray-600">{i18n.qrPayments}</p>}
                        </Card>
                    </Section>
                )}

                {/* FAQs */}
                {seo.faqs.length > 0 && <FAQSection faqs={seo.faqs} title={i18n.frequentlyAskedQuestions} />}

                {/* Other countries grid */}
                <DestinationGrid countries={otherCountries} title={i18n.hubExploreCountries} locale={locale} />

                {/* Last updated */}
                <p className="py-4 text-xs text-gray-400">
                    {t(i18n.lastUpdated, { date: new Date().toISOString().split('T')[0] })}
                </p>
            </MarketingShell>
        </>
    )
}
