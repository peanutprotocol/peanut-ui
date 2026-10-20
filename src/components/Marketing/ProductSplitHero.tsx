'use client'

import type { ReactNode } from 'react'
import { motion, MotionConfig, type TargetAndTransition } from 'framer-motion'
import { HeroBackNav } from '@/components/Marketing/HeroBackNav'
import { twMerge } from '@/utils/tw'
import Sparkle from '@/assets/illustrations/sparkle.svg'
import Star from '@/assets/illustrations/star.svg'

const NO_JS_DECO = '<style>.psh-deco{opacity:1!important;transform:none!important}</style>'

interface ProductSplitHeroProps {
    /** Small tracked-caps line above the headline, part of the h1 (the product wordmark). */
    eyebrow?: string
    /** A string is set in the display ramp. A node is rendered as given inside
        the h1, for a headline that mixes a Roboto line with a knerd `Title`. */
    headline: ReactNode
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
    /** `start` (default): text left on every width, CTA under the copy — the
        /shhhhh look. `center`: on phones the copy is centred and the art sits
        between the copy and the CTA (the star-feature LP order); from `md`
        it is the same split as `start`. */
    align?: 'start' | 'center'
}

/**
 * The sub-LP hero: text left, product art right, on the
 * brand pink ground. Star-feature and campaign LPs build on this composition;
 * /shhhhh is its first caller and the visual reference.
 */
export function ProductSplitHero({
    eyebrow,
    headline,
    pitch,
    lead,
    cta,
    art,
    disclaimer,
    align = 'start',
}: ProductSplitHeroProps) {
    const centered = align === 'center'
    // /shhhhh (`start`) keeps its original whileInView springs; the centred
    // star-LP hero always sits at the top, so it plays on mount.
    const reveal = (target: TargetAndTransition) => (centered ? { animate: target } : { whileInView: target })
    const heading = (
        <h1>
            {eyebrow && (
                <span className="font-roboto-flex-extrabold block pl-12 text-body-s-semibold uppercase md:pl-0">
                    {eyebrow}
                </span>
            )}
            {typeof headline === 'string' ? (
                <span className="font-roboto-flex-extrabold mt-2 block text-headingMedium font-extraBlack md:text-headingLarge">
                    {headline}
                </span>
            ) : (
                headline
            )}
        </h1>
    )
    const copyWidth = centered ? 'mx-auto max-w-xl md:mx-0' : 'max-w-xl'
    const copy = (
        <>
            {pitch && (
                <p
                    className={`font-roboto-flex-extrabold mt-6 text-heading-s uppercase md:text-heading-m ${copyWidth}`}
                >
                    {pitch}
                </p>
            )}
            {/* centred (star LPs): plain body Roboto, so the lead keeps text-body-l's
                26px leading like every other body line; .font-roboto-flex would
                force 100% leading and -1px tracking. */}
            {lead && (
                <p
                    className={twMerge(
                        !centered && 'font-roboto-flex',
                        centered && 'psh-lead-fit',
                        'mt-6 text-body-l',
                        copyWidth
                    )}
                >
                    {lead}
                </p>
            )}
        </>
    )
    const ctaSparkle = (
        <motion.img
            src={Sparkle.src}
            alt=""
            aria-hidden
            initial={{ opacity: 0, scale: 0.4, rotate: -30 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 10, delay: 0.6 }}
            className="psh-deco pointer-events-none absolute -top-4 -right-4 w-8 md:-top-5 md:-right-5 md:w-10"
        />
    )
    // The lead star. In `start` (/shhhhh) it sits on the section; in `center`
    // it is anchored to the copy cell, so it clears the h1 at every width:
    // above the copy's right end on phones (the back button owns the left),
    // and above the first line from md, clear of the back button.
    const leadStar = (position: string) => (
        <motion.img
            src={Star.src}
            alt=""
            aria-hidden
            initial={{ opacity: 0, translateY: 20, translateX: 5 }}
            {...reveal({ opacity: 1, translateY: 0, translateX: 0 })}
            transition={{ type: 'spring', damping: 5 }}
            className={`psh-deco pointer-events-none ${position}`}
        />
    )
    const artBlock = (
        <>
            {art}
            {disclaimer && (
                <p className="font-roboto-flex mt-8 text-body-xs text-foreground-primary/70 md:text-body-s">
                    {disclaimer}
                </p>
            )}
        </>
    )
    return (
        // The decorations are pure garnish, so the springs stop for anyone who
        // asked the OS for less motion.
        <MotionConfig reducedMotion="user">
            <section
                className={twMerge(
                    'relative overflow-hidden bg-background-brand px-4 py-20 text-foreground-primary md:py-24',
                    centered && 'psh-fit'
                )}
            >
                {/* framer serialises the hidden start state inline; no-JS visitors get the garnish at rest */}
                <noscript dangerouslySetInnerHTML={{ __html: NO_JS_DECO }} />
                <HeroBackNav />
                {!centered && leadStar('absolute top-[8%] left-[3%] z-10 w-10 md:top-[12%] md:left-[6%] md:w-14')}
                <motion.img
                    src={Star.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, translateY: 28, translateX: -5 }}
                    {...reveal({ opacity: 1, translateY: 0, translateX: 0 })}
                    transition={{ type: 'spring', damping: 5, delay: 0.15 }}
                    className="psh-deco pointer-events-none absolute right-[4%] bottom-[5%] z-10 w-8 md:right-[8%] md:bottom-[8%] md:w-12"
                />
                <motion.img
                    src={Sparkle.src}
                    alt=""
                    aria-hidden
                    initial={{ opacity: 0, scale: 0.4 }}
                    {...reveal({ opacity: 1, scale: 1 })}
                    transition={{ type: 'spring', damping: 8, delay: 0.3 }}
                    className="psh-deco pointer-events-none absolute top-[10%] right-[12%] z-10 hidden w-8 md:block md:w-10"
                />
                {centered ? (
                    // Three cells so phones read copy, art, CTA while md+ keeps
                    // the split: copy over CTA on the left, art on the right.
                    // max-w-7xl: the same 1280 column as the Bands below, so the h1,
                    // the fold h2s and the FAQ share a left edge.
                    <div className="psh-fit-grid relative z-20 mx-auto grid max-w-7xl grid-cols-1 items-center gap-8 text-center md:grid-cols-2 md:gap-x-12 md:text-left">
                        <div className="psh-copy-fit relative min-w-0 md:col-start-1 md:row-start-1 md:self-end">
                            {leadStar(
                                'psh-star-fit absolute -top-12 right-0 w-10 md:-top-16 md:right-auto md:left-14 md:w-14'
                            )}
                            {heading}
                            {copy}
                        </div>
                        <div className="psh-art-fit mx-auto w-full max-w-md md:col-start-2 md:row-span-2 md:row-start-1">
                            {artBlock}
                        </div>
                        <div className="psh-cta-fit relative mx-auto w-fit md:col-start-1 md:row-start-2 md:mx-0 md:self-start">
                            {cta}
                            {ctaSparkle}
                        </div>
                    </div>
                ) : (
                    <div className="relative z-20 mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 md:grid-cols-2">
                        <div className="min-w-0">
                            {/* The star above sits where the eyebrow starts, so the eyebrow
                                steps right of it on phones. */}
                            {heading}
                            {copy}
                            <div className="relative mt-8 w-fit">
                                {cta}
                                {ctaSparkle}
                            </div>
                        </div>
                        <div className="mx-auto w-full max-w-md">{artBlock}</div>
                    </div>
                )}
            </section>
        </MotionConfig>
    )
}
