'use client'

import noHiddenFees from '@/assets/illustrations/no-hidden-fees.svg'
import Star from '@/assets/illustrations/star.svg'
import Image from 'next/image'
import ExchangeRateWidget from '../Global/ExchangeRateWidget'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { ContextualLinks } from './ContextualLinks'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import { CloudsCss } from './CloudsCss'
import type { LandingStrings } from './landingStrings'
import type { LandingContentHrefs } from './landingContentHrefs'

export function NoFees({
    className,
    strings,
    contentHrefs,
}: {
    className?: string
    strings: LandingStrings
    contentHrefs: LandingContentHrefs
}) {
    const router = useRouter()
    /*
     * Session is read from the cookie rather than AuthProvider: that context is
     * the only thing that kept react-query and the redux store mounted on the
     * marketing site. Native keeps its token outside cookies, but the landing
     * page there is a bootstrap shell that redirects away before this matters.
     */
    const handleCtaAction = async (sourceCurrency: string, destinationCurrency: string) => {
        const signedIn = typeof document !== 'undefined' && /(^|;\s*)jwt-token=/.test(document.cookie)
        if (!signedIn) {
            router.push('/setup')
            return
        }
        const { resolveExchangeCtaRoute } = await import('./exchangeCtaRoute')
        router.push(await resolveExchangeCtaRoute(sourceCurrency, destinationCurrency))
    }

    return (
        <section
            id="no-fees"
            className={twMerge('relative overflow-hidden bg-secondary-3 px-4 py-24 md:py-14', className)}
        >
            {/* CSS keyframes rather than framer-motion: these loop forever, and a
                perpetual rAF loop on the main thread was the landing page's single
                largest blocking cost. transform animations run on the compositor. */}
            <CloudsCss
                clouds={[
                    { top: '20%', width: 200, speed: '37s', direction: 'ltr' },
                    { top: '60%', width: 220, speed: '33s', direction: 'rtl' },
                ]}
            />

            <div className="relative mx-auto w-full max-w-3xl text-center">
                {/* Animated stars */}
                <AnimateOnView className="absolute -right-36 -top-12" y="20px" x="5px" rotate="22deg" delay="0.2s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -right-58 top-30" y="28px" x="-5px" rotate="-17deg" delay="0.4s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView
                    className="absolute -right-0 -top-16 md:top-58"
                    y="20px"
                    x="5px"
                    rotate="22deg"
                    delay="0.6s"
                >
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -left-36 -top-20" y="15px" x="-5px" rotate="-7deg" delay="0.8s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -bottom-6 -left-10" y="25px" x="-5px" rotate="-5deg" delay="1.0s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>

                <h1 className="font-roboto-flex-extrabold text-heading text-black md:text-headingMedium">
                    {strings.zeroFees}
                </h1>

                {/* No hidden fees SVG */}
                <div className="mb-1">
                    <Image
                        src={noHiddenFees}
                        alt="Really, we mean zero. No hidden fees"
                        width={600}
                        height={150}
                        className="mx-auto h-auto w-full max-w-xs md:max-w-md"
                    />
                </div>

                <ExchangeRateWidget
                    ctaIcon="arrow-up-right"
                    ctaLabel={strings.sendMoney}
                    ctaAction={handleCtaAction}
                    labels={strings.exchange}
                />

                <ContextualLinks
                    className="mt-6"
                    label={strings.seeMarkupOn}
                    links={[
                        // the route is `peanut-vs-<slug>` — generateStaticParams builds
                        // no bare-slug page, so the short form 404s
                        { label: 'Wise', href: contentHrefs.wiseComparison },
                        { label: 'PayPal', href: contentHrefs.paypalComparison },
                        { label: 'Western Union', href: contentHrefs.westernUnionComparison },
                    ]}
                />
            </div>
        </section>
    )
}
