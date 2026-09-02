'use client'

import gotItHand from '@/assets/illustrations/got-it-hand.svg'
import gotItHandFlipped from '@/assets/illustrations/got-it-hand-flipped.svg'
import scribbleCircle from '@/assets/illustrations/scribble-circle.svg'
import Star from '@/assets/illustrations/star.svg'
import Image from 'next/image'
import ExchangeRateWidget from '../Global/ExchangeRateWidget'
import { useRouter } from 'next/navigation'
import { twMerge } from '@/utils/tw'
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

    // One vw ramp can't serve every locale: "TRANSFER" only clips under ~340px,
    // while "TRANSFERENCIA"/"TRANSFERÊNCIA" (both 491px at 60px) need ~545px.
    // <html lang> is SSR'd as "en" and only corrected after hydration, so a
    // :lang() ramp would first paint at the EN size and jump on the es/pt pages.
    // At 320px the ramps carry a longest word of 337px / 540px at 60px, which
    // is 8 / 14 characters — messages.test.ts holds the catalogs to that.
    const headlineSize =
        Math.max(...strings.zeroFees.split(' ').map((word) => word.length)) > 8
            ? 'text-[min(10vw,3.75rem)]'
            : 'text-[min(16vw,3.75rem)]'

    // The scribble circles the closing word of the line, so each catalog picks
    // what gets circled just by putting that word last.
    const lastSpace = strings.reallyZero.lastIndexOf(' ')
    const reallyZeroLead = lastSpace === -1 ? '' : strings.reallyZero.slice(0, lastSpace + 1)
    const reallyZeroCircled = lastSpace === -1 ? strings.reallyZero : strings.reallyZero.slice(lastSpace + 1)

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
                <AnimateOnView className="absolute -top-12 -right-36" y="20px" x="5px" rotate="22deg" delay="0.2s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute top-30 -right-58" y="28px" x="-5px" rotate="-17deg" delay="0.4s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView
                    className="absolute -top-16 -right-0 md:top-58"
                    y="20px"
                    x="5px"
                    rotate="22deg"
                    delay="0.6s"
                >
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -top-20 -left-36" y="15px" x="-5px" rotate="-7deg" delay="0.8s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>
                <AnimateOnView className="absolute -bottom-6 -left-10" y="25px" x="-5px" rotate="-5deg" delay="1.0s">
                    <Image src={Star} alt="Floating Star" width={50} height={50} />
                </AnimateOnView>

                {/* fluid below md so the longest word of the headline still
                    fits at 320px; unchanged from md up */}
                <h1 className={`font-roboto-flex-extrabold ${headlineSize} text-black md:text-headingMedium`}>
                    {strings.zeroFees}
                </h1>

                {/* Was a single SVG with the copy baked into vector paths — the
                    lettering is real text now so it localizes; only the doodles
                    stay as art. Sizes are cqw/em so the block scales exactly as
                    the SVG did. */}
                <div className="@container mx-auto mb-1 w-full max-w-xs md:max-w-md">
                    {/* cqw sizing has to sit inside the container, not on it */}
                    <div className="pt-[0.23em] font-sans text-[9.79cqw]/[1.21] font-[450] tracking-[-0.058em] text-black">
                        <p>
                            {reallyZeroLead}
                            <span className="relative inline-block">
                                {reallyZeroCircled}
                                <Image
                                    src={scribbleCircle}
                                    alt=""
                                    aria-hidden
                                    className="pointer-events-none absolute -top-[0.23em] -left-[0.27em] h-[1.54em] w-[calc(100%+0.52em)] max-w-none"
                                />
                            </span>
                        </p>
                        <p className="flex items-center justify-center gap-[0.19em]">
                            <Image src={gotItHand} alt="" aria-hidden className="w-[0.887em] shrink-0" />
                            <span>{strings.noHiddenFees}</span>
                            <Image src={gotItHandFlipped} alt="" aria-hidden className="w-[0.887em] shrink-0" />
                        </p>
                    </div>
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
