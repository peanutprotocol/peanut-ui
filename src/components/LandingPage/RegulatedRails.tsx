import Image from 'next/image'
import Link from 'next/link'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
import BBVA_ICON from '@/assets/icons/bbva-logo.svg'
import BRUBANK_ICON from '@/assets/icons/brubank-logo.svg'
import N26_ICON from '@/assets/icons/n26-logo.svg'
import SANTANDER_ICON from '@/assets/icons/santander-logo.svg'
import REVOLUT_ICON from '@/assets/icons/revolut-logo.svg'
import STRIPE_ICON from '@/assets/icons/stripe-logo.svg'
import MERCADO_PAGO_ICON from '@/assets/icons/mercado-pago-logo.svg'
import PIX_ICON from '@/assets/icons/pix-logo.svg'
import WISE_ICON from '@/assets/icons/wise-logo.svg'
import Star from '@/assets/illustrations/star.svg'
import { CloudsCss } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { EN_LANDING_CONTENT_HREFS, type LandingContentHrefs, type LandingContentHrefKey } from './landingContentHrefs'

const bgColor = '#F9F4F0'

/**
 * `hrefKey` selects the server-resolved page that honestly explains what this
 * partner does with Peanut. A logo with nothing truthful to point at stays
 * unlinked — Brubank and Stripe have no article covering their rail, so they do.
 *
 * `onWhite` gives a logo a white card behind it: these two are the only marks
 * in the set that are not a heavy wordmark, and they disappear on the pink.
 */
const logos: Array<{
    logo: typeof BBVA_ICON
    alt: string
    hrefKey?: LandingContentHrefKey
    onWhite?: boolean
}> = [
    { logo: BBVA_ICON, alt: 'BBVA', hrefKey: 'depositBank' },
    { logo: BRUBANK_ICON, alt: 'Brubank' },
    { logo: N26_ICON, alt: 'N26', hrefKey: 'depositBank' },
    { logo: SANTANDER_ICON, alt: 'Santander', hrefKey: 'depositBank' },
    { logo: REVOLUT_ICON, alt: 'Revolut', hrefKey: 'revolutComparison' },
    { logo: STRIPE_ICON, alt: 'Stripe' },
    { logo: MERCADO_PAGO_ICON, alt: 'Mercado Pago', hrefKey: 'mercadoPagoQr', onWhite: true },
    { logo: PIX_ICON, alt: 'PIX', hrefKey: 'brazil', onWhite: true },
    { logo: WISE_ICON, alt: 'Wise', hrefKey: 'wiseComparison' },
]

// my-2, not mb-2: react-fast-marquee's container is overflow-x:hidden, which
// makes the Y axis compute to auto — it clips. Without top margin the tile sits
// flush against that edge and the hover lift shaves its top border off.
const tileClass = 'btn btn-purple btn-shadow-primary-4 mx-7 my-2 flex h-26 w-48 items-center gap-2'
const linkedTileClass = `${tileClass} transition-transform hover:-translate-y-0.5 hover:opacity-90`

const regulatedRailsClouds = [
    { top: '20%', width: 200, speed: '38s', direction: 'ltr' as const },
    { top: '60%', width: 220, speed: '34s', direction: 'rtl' as const },
]

export function RegulatedRails({
    locale = DEFAULT_LOCALE,
    contentHrefs = EN_LANDING_CONTENT_HREFS,
}: {
    locale?: Locale
    contentHrefs?: LandingContentHrefs
}) {
    const i18n = getTranslations(locale)

    return (
        <section
            id="regulated-rails"
            className="relative overflow-hidden py-20 text-n-1"
            style={{ backgroundColor: bgColor }}
        >
            <CloudsCss clouds={regulatedRailsClouds} />

            <div className="relative max-w-5xl px-10 py-8 md:px-24 md:py-16">
                <AnimateOnView className="absolute -right-72 -top-12" delay="0.2s" x="5px" rotate="22deg">
                    <Image src={Star} alt="" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -right-0 -top-16 md:top-58" delay="0.6s" x="5px" rotate="22deg">
                    <Image src={Star} alt="" width={50} height={50} />
                </AnimateOnView>

                <h1 className="font-roboto-flex-extrabold text-left text-[3.25rem] font-extraBlack !leading-[5rem] md:text-6xl lg:text-headingMedium">
                    {i18n.landingRailsHeading}
                </h1>
                <p className="font-roboto-flex mt-6 text-left text-xl md:text-4xl">{i18n.landingRailsBody}</p>

                <h6 className="font-roboto-flex mt-3 text-right text-xs md:text-lg">
                    <a
                        href={contentHrefs.supportedGeographies}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-n-1 underline"
                    >
                        {i18n.landingLearnMore}
                    </a>
                </h6>
            </div>

            <div className="w-full">
                <p className="mb-4 text-center text-sm font-medium uppercase tracking-widest text-n-1 opacity-60">
                    {i18n.landingWorksWith}
                </p>
                <MarqueeWrapper backgroundColor="#FFFFFF" direction="right" className="border-none">
                    {logos.map((logo) => {
                        const mark = (
                            <Image
                                src={logo.logo}
                                alt={logo.alt}
                                width={101}
                                height={32}
                                className={logo.onWhite ? 'rounded-sm border border-n-1 bg-white px-3 py-2' : ''}
                            />
                        )
                        return logo.hrefKey ? (
                            <Link key={logo.alt} href={contentHrefs[logo.hrefKey]} className={linkedTileClass}>
                                {mark}
                            </Link>
                        ) : (
                            <div key={logo.alt} className={tileClass}>
                                {mark}
                            </div>
                        )
                    })}
                </MarqueeWrapper>
            </div>
        </section>
    )
}
