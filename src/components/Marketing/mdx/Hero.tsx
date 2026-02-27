import Link from 'next/link'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { HandThumbsUp } from '@/assets'

const marketingClouds = [
    { top: '15%', width: 160, speed: '45s', direction: 'ltr' as const },
    { top: '55%', width: 180, speed: '50s', direction: 'rtl' as const },
    { top: '85%', width: 150, speed: '48s', direction: 'ltr' as const, delay: '8s' },
]

interface HeroProps {
    title: string
    subtitle?: string
    cta?: string
    ctaHref?: string
    /** @deprecated — ignored. Use standalone <ExchangeWidget> in MDX body instead. */
    currency?: string
}

/**
 * MDX Hero — large bold title (Roboto Flex), subtitle, white CTA button
 * on pink background.
 */
export function Hero({ title, subtitle, cta, ctaHref }: HeroProps) {
    return (
        <>
            <section className="relative overflow-hidden bg-primary-1 px-4 py-16 text-center md:px-8 md:py-24">
                <CloudsCss clouds={marketingClouds} />
                <div className="relative z-10 mx-auto max-w-4xl">
                    <h1 className="font-roboto-flex-extrabold text-[2.5rem] font-extraBlack uppercase leading-[0.95] text-black md:text-[4.5rem]">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="font-roboto-flex-extrabold mt-6 text-[1.25rem] uppercase text-black md:mt-8 md:text-[2rem]">
                            {subtitle}
                        </p>
                    )}
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
                message={['No fees', 'Instant', '24/7', 'Dollars', 'USDT/USDC']}
                imageSrc={HandThumbsUp.src}
                backgroundColor="bg-secondary-1"
            />
            {/* Spacer ensures consistent gap between Hero block and prose content */}
            <div className="h-10 md:h-14" />
        </>
    )
}
