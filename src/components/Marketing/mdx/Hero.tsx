import { Button } from '@/components/0_Bruddle/Button'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import HandThumbsUp from '@/assets/illustrations/hand-thumbs-up.svg'
import { getTranslations } from '@/i18n'
import { DEFAULT_LOCALE, type Locale } from '@/i18n/types'
import { CTA_WIDTH, PROSE_WIDTH } from '../constants'

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
    /** Injected by createMdxComponents — never authored in MDX. */
    locale?: Locale
    /** Language of `subtitle` when it differs from the prose around the Hero (a route-locale string on an English fallback page). */
    subtitleLang?: Locale
}

/**
 * MDX Hero — large bold title (Roboto Flex), subtitle, white CTA button
 * on pink background.
 */
export function Hero({ title, subtitle, cta, ctaHref, locale = DEFAULT_LOCALE, subtitleLang }: HeroProps) {
    const i18n = getTranslations(locale)
    return (
        <>
            <section className="relative overflow-hidden bg-background-brand px-6 py-16 text-center md:px-8 md:py-24">
                <CloudsCss clouds={marketingClouds} />
                <div className={`relative z-10 mx-auto ${PROSE_WIDTH}`}>
                    {/* break-words only, no hyphens-auto: it split brand names
                        mid-word ("PEA-NUT", "BI-NANCE") on es/pt pages. A too-long
                        word ("ESTABELECIMENTO") still soft-wraps instead of
                        clipping at 320px (TASK-22366 sweep); the real fix for
                        those is shorter h1 copy (content-side, ruled 15 Oct) —
                        hero sizes stay fixed (standing exception 2026-09-17). */}
                    <h1 className="font-roboto-flex-extrabold text-[2.5rem] leading-[0.95] font-extraBlack break-words text-foreground-primary uppercase md:text-[4.5rem]">
                        {title}
                    </h1>
                    {subtitle && (
                        <p
                            lang={subtitleLang}
                            className="font-roboto-flex-extrabold mt-6 text-[1.25rem] text-foreground-primary uppercase md:mt-8 md:text-[2rem]"
                        >
                            {subtitle}
                        </p>
                    )}
                    {cta && ctaHref && (
                        <div className="mt-8">
                            <Button variant="secondary" href={ctaHref} className={`mx-auto ${CTA_WIDTH}`}>
                                {cta}
                            </Button>
                        </div>
                    )}
                </div>
            </section>
            {/* marquee words come from the route-locale catalog, not the MDX file */}
            <div lang={locale}>
                <MarqueeComp
                    message={[
                        i18n.heroMarqueeNoFees,
                        i18n.heroMarqueeInstant,
                        '24/7',
                        i18n.heroMarqueeDollars,
                        'USDT/USDC',
                    ]}
                    imageSrc={HandThumbsUp.src}
                    backgroundColor="bg-action-secondary"
                />
            </div>
            {/* Spacer ensures consistent gap between Hero block and prose content */}
            <div className="h-10 md:h-14" />
        </>
    )
}
