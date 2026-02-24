import Image from 'next/image'
import { MarqueeWrapper } from '../Global/MarqueeWrapper'
import {
    BBVA_ICON,
    BRUBANK_ICON,
    N26_ICON,
    SANTANDER_ICON,
    REVOLUT_ICON,
    STRIPE_ICON,
    MERCADO_PAGO_ICON,
    PIX_ICON,
    WISE_ICON,
    Star,
} from '@/assets'
import { CloudsCss } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'

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

export function RegulatedRails() {
    return (
        <section
            id="regulated-rails"
            className="relative overflow-hidden py-20 text-n-1"
            style={{ backgroundColor: bgColor }}
        >
            <CloudsCss clouds={regulatedRailsClouds} />

            <div className="relative max-w-5xl px-10 py-8 md:px-24 md:py-16">
                <AnimateOnView className="absolute -right-72 -top-12" delay="0.2s" x="5px" rotate="22deg">
                    <img src={Star.src} alt="" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -right-0 -top-16 md:top-58" delay="0.6s" x="5px" rotate="22deg">
                    <img src={Star.src} alt="" width={50} height={50} />
                </AnimateOnView>

                <h1 className="font-roboto-flex-extrabold text-left text-[3.25rem] font-extraBlack !leading-[5rem] md:text-6xl lg:text-headingMedium">
                    REGULATED RAILS, SELF-CUSTODY CONTROL
                </h1>
                <p className="font-roboto-flex mt-6 text-left text-xl md:text-4xl">
                    Peanut is a self-custodial wallet that seamlessly connects to banks and payment networks (examples
                    below) via multiple third party partners who operate under international licenses and standards to
                    keep every transaction secure, private, and under your control.
                </p>

                <h6 className="font-roboto-flex mt-3 text-xs md:text-lg">
                    Our partners hold{' '}
                    <a
                        href="https://www.bridge.xyz/legal/licenses/us-licenses-and-registrations"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-n-1 underline"
                    >
                        MSB
                    </a>{' '}
                    licenses and are compliant under{' '}
                    <a
                        href="https://withpersona.com/security"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-n-1 underline"
                    >
                        GDPR and CCPA/CPRA
                    </a>
                    &nbsp; frameworks
                </h6>
            </div>

            <div className="w-full">
                <MarqueeWrapper backgroundColor="#FFFFFF" direction="right" className="border-none ">
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
