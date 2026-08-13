'use client'

import Link from 'next/link'
import { Button } from '@/components/0_Bruddle/Button'
import ExchangeRateWidget from '@/components/Global/ExchangeRateWidget'
import type { Locale } from '@/i18n/types'
import type { LandingStrings } from './landingStrings'

const tileClassName = 'rounded-sm border-2 border-n-1 bg-white p-5.5 shadow-4 md:p-7'
const tileTitleClassName = 'font-roboto-flex-extrabold text-lg font-extraBlack uppercase leading-tight md:text-xl'
const tileBodyClassName = 'font-roboto-flex text-base leading-relaxed'
const chipClassName =
    'inline-flex items-center rounded-sm border-2 border-n-1 bg-white px-2.5 py-1.5 text-xs font-extraBlack uppercase tracking-wide'

// Brand names, not translatable. Slugs match the compare pages in src/content;
// the route adds the "peanut-vs-" prefix (see compare/[slug]/page.tsx, which
// sets dynamicParams = false — an unprefixed slug 404s).
const comparePages = [
    { label: 'Wise', slug: 'wise' },
    { label: 'PayPal', slug: 'paypal' },
    { label: 'Western Union', slug: 'western-union' },
] as const

export function WorksToday({ strings, locale }: { strings: LandingStrings; locale: Locale }) {
    const { worksToday } = strings
    const corridorChips = [worksToday.payLocalChipEurPix, worksToday.payLocalChipUsdMercadoPago]

    return (
        <section
            id="works-today"
            data-own-cta
            className="relative overflow-hidden bg-green-1 px-4 py-18 text-n-1 md:py-28"
        >
            <div className="mx-auto max-w-6xl">
                <h2 className="font-roboto-flex-extrabold text-4xl font-extraBlack uppercase md:text-heading">
                    {worksToday.heading}
                </h2>
                <p className="font-roboto-flex mt-3.5 text-lg font-bold">{worksToday.subline}</p>

                <div className="mt-7 grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-5.5">
                    <div className={tileClassName}>
                        <h3 className={tileTitleClassName}>{worksToday.payLocalTitle}</h3>
                        <p className={`${tileBodyClassName} mt-2.5`}>{worksToday.payLocalBody}</p>
                        <p className="font-roboto-flex mt-2.5 text-sm font-bold opacity-70">
                            {worksToday.payLocalNote}
                        </p>
                        <p className={`${tileBodyClassName} mt-3`}>{worksToday.payLocalMoneyOut}</p>
                        <div className="mt-3.5 flex flex-wrap gap-2">
                            {corridorChips.map((chip) => (
                                <span key={chip} className={chipClassName}>
                                    {chip}
                                </span>
                            ))}
                        </div>
                    </div>

                    <div className={tileClassName}>
                        <h3 className={tileTitleClassName}>{worksToday.dropLinkTitle}</h3>
                        <p className={`${tileBodyClassName} mt-2.5`}>{strings.dropLinkBody}</p>
                    </div>

                    <div className={`${tileClassName} md:col-span-2`}>
                        <h3 className={tileTitleClassName}>{worksToday.rateTitle}</h3>
                        {/* Rate only — the beat already ends on one CTA, and the
                            fee rows repeat a claim the marquee just made. */}
                        <ExchangeRateWidget
                            hideCta
                            hideFees
                            defaultFrom="USD"
                            defaultTo="BRL"
                            labels={strings.exchange}
                        />
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="font-roboto-flex text-sm font-extraBlack">{strings.seeMarkupOn}</span>
                            {comparePages.map((page) => (
                                <Link
                                    key={page.slug}
                                    href={`/${locale}/compare/peanut-vs-${page.slug}`}
                                    className={`${chipClassName} text-sm`}
                                >
                                    {page.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className={`${tileClassName} md:col-span-2`}>
                        <h3 className={tileTitleClassName}>{worksToday.securityTitle}</h3>
                        <p className={`${tileBodyClassName} mt-2.5`}>{worksToday.securityBody}</p>
                    </div>
                </div>

                <Link href="/setup" className="mt-7 block">
                    <Button variant="purple" shadowSize="4" className="w-full">
                        {strings.signUpNow}
                    </Button>
                </Link>
            </div>
        </section>
    )
}
