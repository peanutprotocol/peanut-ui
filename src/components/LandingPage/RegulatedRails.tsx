import Image from 'next/image'
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

const bgColor = '#F9F4F0'

const logos = [
    { logo: BBVA_ICON, alt: 'BBVA' },
    { logo: BRUBANK_ICON, alt: 'Brubank' },
    { logo: N26_ICON, alt: 'N26' },
    { logo: SANTANDER_ICON, alt: 'Santander' },
    { logo: REVOLUT_ICON, alt: 'Revolut' },
    { logo: STRIPE_ICON, alt: 'Stripe' },
    { logo: MERCADO_PAGO_ICON, alt: 'Mercado Pago' },
    { logo: PIX_ICON, alt: 'PIX' },
    { logo: WISE_ICON, alt: 'Wise' },
]

const regulatedRailsClouds = [
    { top: '20%', width: 200, speed: '38s', direction: 'ltr' as const },
    { top: '60%', width: 220, speed: '34s', direction: 'rtl' as const },
]

export function RegulatedRails({ locale = DEFAULT_LOCALE }: { locale?: Locale }) {
    const i18n = getTranslations(locale)

    return (
        <section
            id="regulated-rails"
            className="relative overflow-hidden py-20 text-n-1"
            style={{ backgroundColor: bgColor }}
        >
            <CloudsCss clouds={regulatedRailsClouds} />

            <div className="relative max-w-5xl px-10 py-8 md:px-24 md:py-16">
                <AnimateOnView className="absolute -top-12 -right-72" delay="0.2s" x="5px" rotate="22deg">
                    <Image src={Star} alt="" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -top-16 -right-0 md:top-58" delay="0.6s" x="5px" rotate="22deg">
                    <Image src={Star} alt="" width={50} height={50} />
                </AnimateOnView>

                <h1 className="font-roboto-flex-extrabold text-left text-[3.25rem] !leading-[5rem] font-extraBlack md:text-6xl lg:text-headingMedium">
                    {i18n.landingRailsHeading}
                </h1>
                <p className="font-roboto-flex mt-6 text-left text-xl md:text-4xl">{i18n.landingRailsBody}</p>

                <h6 className="font-roboto-flex mt-3 text-xs md:text-lg">
                    <a
                        href={`/${locale}/help/supported-geographies`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-n-1 underline"
                    >
                        {i18n.landingLearnMore}
                    </a>
                </h6>
            </div>

            <div className="w-full">
                <p className="mb-4 text-center text-sm font-medium tracking-widest text-n-1 uppercase opacity-60">
                    {i18n.landingWorksWith}
                </p>
                <MarqueeWrapper backgroundColor="#FFFFFF" direction="right" className="border-none">
                    {logos.map((logo) => (
                        <div
                            key={logo.alt}
                            className="btn btn-purple btn-shadow-primary-4 mx-7 mb-2 flex h-26 w-48 items-center gap-2"
                        >
                            <Image src={logo.logo} alt={logo.alt} width={101} height={32} />
                        </div>
                    ))}
                </MarqueeWrapper>
            </div>
        </section>
    )
}
