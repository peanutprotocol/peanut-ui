import Title from '@/components/0_Bruddle/Title'
import Link from 'next/link'
import { CloudsCss } from '@/components/LandingPage/CloudsCss'
import { MarqueeComp } from '@/components/Global/MarqueeWrapper'
import { HandThumbsUp } from '@/assets'

const marketingClouds = [
    { top: '15%', width: 160, speed: '45s', direction: 'ltr' as const },
    { top: '55%', width: 180, speed: '50s', direction: 'rtl' as const },
    { top: '85%', width: 150, speed: '48s', direction: 'ltr' as const, delay: '8s' },
]

interface MarketingHeroProps {
    title: string
    subtitle: string
    ctaText?: string
    ctaHref?: string
}

export function MarketingHero({ title, subtitle, ctaText = 'Get Started', ctaHref = '/home' }: MarketingHeroProps) {
    return (
        <>
            <section className="relative overflow-hidden bg-primary-1 px-4 py-16 text-center md:px-8 md:py-20">
                <CloudsCss clouds={marketingClouds} />
                <div className="relative z-10 mx-auto max-w-3xl">
                    <h1>
                        <Title text={title} className="text-4xl md:text-6xl" />
                    </h1>
                    <p className="mt-4 text-lg font-bold text-black md:text-2xl">{subtitle}</p>
                    {ctaText && (
                        <div className="mt-8">
                            <Link
                                href={ctaHref}
                                className="btn btn-purple btn-shadow-primary-4 inline-flex w-auto px-8 active:translate-x-[3px] active:translate-y-[4px] active:shadow-none"
                            >
                                {ctaText}
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
        </>
    )
}
