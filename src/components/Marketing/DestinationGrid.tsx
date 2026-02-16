import Link from 'next/link'
import { Card } from '@/components/0_Bruddle/Card'
import { COUNTRIES_SEO, getCountryName } from '@/data/seo'
import { getFlagUrl, findMappingBySlug } from '@/constants/countryCurrencyMapping'
import { localizedPath } from '@/i18n/config'
import type { Locale } from '@/i18n/types'

interface DestinationGridProps {
    /** If provided, only show these country slugs */
    countries?: string[]
    title?: string
    locale?: Locale
}

export function DestinationGrid({ countries, title = 'Send money to', locale = 'en' }: DestinationGridProps) {
    const slugs = countries ?? Object.keys(COUNTRIES_SEO)

    return (
        <section className="py-10 md:py-14">
            {title && <h2 className="mb-6 text-h2 font-bold md:text-h1">{title}</h2>}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {slugs.map((slug) => {
                    const seo = COUNTRIES_SEO[slug]
                    if (!seo) return null

                    const mapping = findMappingBySlug(slug)

                    const countryName = getCountryName(slug, locale)
                    const flagCode = mapping?.flagCode

                    return (
                        <Link key={slug} href={localizedPath('send-money-to', locale, slug)}>
                            <Card shadowSize="4" className="flex-row items-center gap-3 p-4 transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-primary-6">
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
