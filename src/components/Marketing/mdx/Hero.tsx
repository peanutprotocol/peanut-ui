import { Button } from '@/components/0_Bruddle/Button'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'

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
            <section className="relative overflow-hidden bg-action-primary px-4 py-16 text-center md:px-8 md:py-24">
                <CloudsCss clouds={marketingClouds} />
                <div className="relative z-10 mx-auto max-w-4xl">
                    {/* break-words + hyphens: one long word ("COMMUNICATIONS",
                        "INSTANTANEAMENTE") must wrap, not clip, at 320px
                        (TASK-22366 sweep) */}
                    <h1 className="font-roboto-flex-extrabold text-[2.5rem] leading-[0.95] font-extraBlack break-words hyphens-auto text-foreground-primary uppercase md:text-[4.5rem]">
                        {title}
                    </h1>
                    {subtitle && (
                        <p className="font-roboto-flex-extrabold mt-6 text-[1.25rem] text-foreground-primary uppercase md:mt-8 md:text-[2rem]">
                            {subtitle}
                        </p>
                    )}
                    {cta && ctaHref && (
                        <div className="mt-8">
                            {/* white-on-pink CTA: stroke is the closest board
                                variant, and the two overrides keep it looking
                                exactly as it does today — the unconditional
                                white bg cancels stroke's press-to-pink, and the
                                hover shadow cancels stroke's hover flatten. */}
                            <Button
                                variant="stroke"
                                href={ctaHref}
                                className="inline-flex w-auto bg-background-default px-8 font-extrabold hover:bg-background-default/90 hover:shadow-[0.25rem_0.25rem_0_var(--color-shadow-primary)]"
                            >
                                {cta}
                            </Button>
                        </div>
                    )}
                </div>
            </section>
            <MarqueeComp
                message={['No fees', 'Instant', '24/7', 'Dollars', 'USDT/USDC']}
                imageSrc={HandThumbsUp.src}
                backgroundColor="bg-action-secondary"
            />
            {/* Spacer ensures consistent gap between Hero block and prose content */}
            <div className="h-10 md:h-14" />
        </>
    )
}
