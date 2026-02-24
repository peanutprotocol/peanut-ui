import Title from '@/components/0_Bruddle/Title'
import Link from 'next/link'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { HandThumbsUp } from '@/assets'
import { ExchangeWidget } from './ExchangeWidget'

const marketingClouds = [
    { top: '15%', width: 160, speed: '45s', direction: 'ltr' as const },
    { top: '55%', width: 180, speed: '50s', direction: 'rtl' as const },
    { top: '85%', width: 150, speed: '48s', direction: 'ltr' as const, delay: '8s' },
]

interface HeroProps {
    title: string
    subtitle: string
    cta?: string
    ctaHref?: string
    /** Default destination currency for the exchange widget (e.g. "ARS", "BRL") */
    currency?: string
}

/**
 * MDX Hero — large bubble title (knerd font, tight stacked lines),
 * Roboto Flex bold subtitle, white CTA button on pink background, with optional exchange widget.
 */
export function Hero({ title, subtitle, cta, ctaHref, currency }: HeroProps) {
    return (
        <>
            <section className="relative overflow-hidden bg-primary-1 px-4 py-16 text-center md:px-8 md:py-24">
                <CloudsCss clouds={marketingClouds} />
                <div className="relative z-10 mx-auto max-w-4xl">
                    <h1>
                        <Title text={title} className="text-6xl leading-[0.8] md:text-8xl md:leading-[0.75]" />
                    </h1>
                    <p className="font-roboto-flex-extrabold mt-6 text-[1.25rem] uppercase text-black md:mt-8 md:text-[2rem]">
                        {subtitle}
                    </p>
                    {cta && ctaHref && (
                        <div className="mt-8">
                            <Link
                                href={ctaHref}
                                className="btn btn-shadow-primary-4 inline-flex w-auto bg-white px-8 font-extrabold hover:bg-white/90 active:translate-x-[3px] active:translate-y-[4px] active:shadow-none"
                            >
                                {cta}
                            </Link>
                        </div>
                    )}
                </div>
            </section>
            <MarqueeComp
                message={['No fees', 'Instant', '24/7', 'Dollars', 'Fiat / Crypto']}
                imageSrc={HandThumbsUp.src}
                backgroundColor="bg-secondary-1"
            />
            {currency && <ExchangeWidget destinationCurrency={currency} />}
            {/* Spacer ensures consistent gap between Hero block and prose content */}
            <div className="h-10 md:h-14" />
        </>
    )
}
