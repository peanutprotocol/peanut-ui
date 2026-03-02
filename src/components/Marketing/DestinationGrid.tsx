import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'
import { COUNTRIES_SEO, getCountryName } from '@/data/seo'
import { getFlagUrl } from '@/constants/countryCurrencyMapping'
import { localizedPath } from '@/i18n/config'
import { CARD_HOVER } from '@/components/Marketing/mdx/constants'
import type { Locale } from '@/i18n/types'

const SLUG_TO_ISO2: Record<string, string> = {
    argentina: 'ar',
    australia: 'au',
    brazil: 'br',
    canada: 'ca',
    colombia: 'co',
    'costa-rica': 'cr',
    indonesia: 'id',
    japan: 'jp',
    kenya: 'ke',
    malaysia: 'my',
    mexico: 'mx',
    pakistan: 'pk',
    peru: 'pe',
    philippines: 'ph',
    poland: 'pl',
    portugal: 'pt',
    singapore: 'sg',
    'south-africa': 'za',
    spain: 'es',
    sweden: 'se',
    tanzania: 'tz',
    thailand: 'th',
    turkey: 'tr',
    'united-arab-emirates': 'ae',
    'united-kingdom': 'gb',
    'united-states': 'us',
    vietnam: 'vn',
}

interface DestinationGridProps {
    /** If provided, only show these country slugs */
    countries?: string[]
    /** Country slug to exclude from the grid */
    exclude?: string
    title?: string
    locale?: Locale
}

export function DestinationGrid({ countries, exclude, title = 'Send money to', locale = 'en' }: DestinationGridProps) {
    let slugs = countries ?? Object.keys(COUNTRIES_SEO)
    if (exclude) slugs = slugs.filter((s) => s !== exclude)

    return (
        <section className="py-10 md:py-14">
            {title && <h2 className="mb-6 text-h2 font-bold md:text-h1">{title}</h2>}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {slugs.map((slug) => {
                    const seo = COUNTRIES_SEO[slug]
                    if (!seo) return null

                    const countryName = getCountryName(slug, locale)
                    const flagCode = SLUG_TO_ISO2[slug]

                    return (
                        <Link key={slug} href={localizedPath('send-money-to', locale, slug)}>
                            <Card shadowSize="4" className={`flex-row items-center gap-3 p-4 ${CARD_HOVER}`}>
                                {flagCode && (
                                    <img
                                        src={getFlagUrl(flagCode)}
                                        alt={`${countryName} flag`}
                                        width={32}
                                        height={24}
                                        className="rounded-sm"
                                    />
                                )}
                                <div>
                                    <span className="font-semibold">{countryName}</span>
                                    <span className="ml-1 text-sm text-black/50">&rarr;</span>
                                </div>
                            </Card>
                        </Link>
                    )
                })}
            </div>
        </section>
    )
}
