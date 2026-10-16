'use client'

import type { ReactNode } from 'react'
import { motion, MotionConfig } from 'framer-motion'
import { HeroBackNav } from '@/components/Marketing/HeroBackNav'
import Sparkle from '@/assets/illustrations/sparkle.svg'
import Star from '@/assets/illustrations/star.svg'
import { CTA_WIDTH } from './constants'

interface ProductSplitHeroProps {
    /** Small tracked-caps line above the headline, part of the h1 (the product wordmark). */
    eyebrow?: string
    headline: string
    /** Uppercase display line under the headline. */
    pitch?: string
    /** Body-size lead paragraph. */
    lead?: string
    /** The page's CTA control; the hero adds the sparkle accent on its corner. */
    cta: ReactNode
    /** Product art for the right column. */
    art: ReactNode
    /** Legal line under the asset, in the size the homepage card fold uses,
        so the hero sells and the fine print stays fine. */
    disclaimer?: string
}

/**
 * The sub-LP hero (ruled 2026-10-14): text left, product art right, on the
 * brand pink ground. Star-feature and campaign LPs build on this composition;
 * /shhhhh is its first caller and the visual reference.
 */
export function ProductSplitHero({ eyebrow, headline, pitch, lead, cta, art, disclaimer }: ProductSplitHeroProps) {
    return (
        // The decorations are pure garnish, so the springs stop for anyone who
        // asked the OS for less motion.
        <MotionConfig reducedMotion="user">
            <section className="relative overflow-hidden bg-background-brand px-4 py-20 text-foreground-primary md:py-24">
                <HeroBackNav />
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 20, translateX: 5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5 }}
                    className="pointer-events-none absolute top-[8%] left-[3%] z-10 w-10 md:top-[12%] md:left-[6%] md:w-14"
                />
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    whileInView={{ opacity: 1, translateY: 0, translateX: 0 }}
                    transition={{ type: 'spring', damping: 5, delay: 0.15 }}
                    className="pointer-events-none absolute right-[4%] bottom-[5%] z-10 w-8 md:right-[8%] md:bottom-[8%] md:w-12"
                />
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', damping: 8, delay: 0.3 }}
                    className="pointer-events-none absolute top-[10%] right-[12%] z-10 hidden w-8 md:block md:w-10"
                />
                <div className="relative z-20 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2">
                    <div className="min-w-0">
                        {/* The star above sits where the eyebrow starts, so the eyebrow
                            steps right of it on phones. */}
                        <h1>
                            {eyebrow && (
                                <span className="font-roboto-flex-extrabold block pl-12 text-body-s-semibold uppercase md:pl-0">
                                    {eyebrow}
                                </span>
                            )}
                            <span className="font-roboto-flex-extrabold mt-2 block text-headingMedium font-extraBlack md:text-headingLarge">
                                {headline}
                            </span>
                        </h1>
                        {pitch && (
                            <p className="font-roboto-flex-extrabold mt-6 max-w-xl text-heading-s uppercase md:text-heading-m">
                                {pitch}
                            </p>
                        )}
                        {lead && <p className="font-roboto-flex mt-6 max-w-xl text-body-l">{lead}</p>}
                        <div className={`relative mt-8 ${CTA_WIDTH}`}>
                            {cta}
                            <motion.img
                                src={Sparkle.src}
                                alt=""
                                aria-hidden
                                initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                transition={{ type: 'spring', damping: 10, delay: 0.6 }}
                                className="pointer-events-none absolute -top-4 -right-4 w-8 md:-top-5 md:-right-5 md:w-10"
                            />
                        </div>
                    </div>
                    <div className="mx-auto w-full max-w-md">
                        {art}
                        {disclaimer && (
                            <p className="font-roboto-flex mt-8 text-body-xs text-foreground-primary/70 md:text-body-s">
                                {disclaimer}
                            </p>
                        )}
                    </div>
                </div>
            </section>
        </MotionConfig>
    )
}
