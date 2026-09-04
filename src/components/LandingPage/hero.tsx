'use client'

import { PeanutWhistling } from '@/assets/mascot'
import { GlobalCashLocalFeel, Star } from '@/assets/illustrations'
import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { CloudsCss, type CloudConfig } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import type { LandingStrings } from './landingStrings'
import type { Locale } from '@/i18n/types'
import { type CTAButton } from '@/components/LandingPage/landing.types'

/**
 * Peanut mascot that positions itself so only 6% of its height (the feet)
 * overlaps with the h2 subtitle below. Measures the h2 position on mount
 * and resize, then sets its own bottom edge to sit 6% into the h2.
 */
function PeanutMascot() {
    const imgRef = useRef<HTMLImageElement>(null)

    const position = useCallback(() => {
        const img = imgRef.current
        const hero = document.getElementById('hero')
        const h2 = hero?.querySelector('h2')
        if (!img || !hero || !h2) return

        const heroRect = hero.getBoundingClientRect()
        const h2Rect = h2.getBoundingClientRect()
        const peanutHeight = img.getBoundingClientRect().height

        if (peanutHeight === 0) return // not rendered yet

        // Position so peanut's feet (bottom 3%) overlap with h2 top
        const overlap = peanutHeight * 0.06
        const peanutBottom = h2Rect.top - heroRect.top + overlap
        const peanutTop = peanutBottom - peanutHeight

        img.style.top = `${peanutTop}px`
    }, [])

    useEffect(() => {
        const img = imgRef.current
        if (!img) return

        // Position once image loads and on resize
        const onLoad = () => {
            position()
            // Re-position after a short delay to account for layout shifts
            setTimeout(position, 500)
        }

        if (img.complete) {
            onLoad()
        } else {
            img.addEventListener('load', onLoad)
        }

        window.addEventListener('resize', position)
        return () => {
            img.removeEventListener('load', onLoad)
            window.removeEventListener('resize', position)
        }
    }, [position])

    return (
        <Image
            ref={imgRef}
            src={PeanutWhistling}
            // Animated webp — the optimizer passes animated images through
            // untouched, so `unoptimized` skips a pointless /_next/image hop.
            unoptimized
            // This is the mobile LCP element. Without `preload` Next emits
            // loading="lazy" and the browser discovers it ~7s late on a
            // throttled connection (Lighthouse: 19.5s LCP, 36% load delay).
            preload
            alt="Peanut Guy"
            className="absolute left-1/2 z-10 h-auto max-h-[40vh] w-auto max-w-[90%] -translate-x-1/2 object-contain md:max-h-[min(40vh,calc(100svh-28rem))]"
        />
    )
}

/*
 * The hero's own cloud bands, PHONE ONLY — three, against the default five.
 * A phone is a third of the width, so five read as overcast rather than sky.
 *
 * The shared default spreads five clouds over the whole section (down to 80%),
 * which on a phone drifts them straight through the CTA — a white cloud behind
 * the white pill erases the button for the length of the loop. These stop at
 * 56%, which puts the lowest one across the headline's second line and leaves
 * the CTA in clear sky. The headline can take it: 38px black extrabold reads
 * over white. The button cannot, being white itself.
 *
 * Desktop keeps the default. The hero is far wider than its centred copy, so
 * the low bands ride the gutters either side of it instead of crossing it.
 */
const heroClouds: CloudConfig[] = [
    { top: '18%', width: 180, speed: '38s', direction: 'ltr' },
    { top: '35%', width: 220, speed: '44s', direction: 'rtl' },
    { top: '52.8%', width: 190, speed: '36s', direction: 'ltr' },
]

type HeroProps = {
    strings: LandingStrings
    locale: Locale
    primaryCta?: CTAButton
    secondaryCta?: CTAButton
    buttonVisible?: boolean
    buttonScale?: number
    /** replaces the primary button entirely (store-button pair on desktop during the migration window) */
    customCta?: React.ReactNode
}

/*
 * CSS custom properties consumed by `.cta-motion` in globals.css, replacing the
 * framer-motion animate/whileHover pair. Same values, but the transform runs on
 * the compositor instead of a main-thread rAF loop.
 */
const getCtaStyle = (variant: 'primary' | 'secondary', buttonVisible?: boolean, buttonScale?: number): CSSProperties =>
    ({
        '--cta-x': buttonVisible ? '0px' : '20px',
        '--cta-y': buttonVisible ? '0px' : '20px',
        '--cta-r': buttonVisible ? '0deg' : '1deg',
        '--cta-scale': buttonScale || 1,
        '--cta-hover-x': variant === 'primary' ? '0px' : '3px',
        opacity: buttonVisible ? 1 : 0,
        pointerEvents: buttonVisible ? 'auto' : 'none',
    }) as CSSProperties

const getButtonContainerClasses = (variant: 'primary' | 'secondary') =>
    `relative z-20 mt-8 flex flex-col items-center justify-center ${variant === 'primary' ? 'mx-auto w-fit' : 'right-[calc(50%-120px)]'}`

export function Hero({
    primaryCta,
    secondaryCta,
    buttonVisible,
    buttonScale = 1,
    customCta,
    strings,
    locale,
}: HeroProps) {
    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => {
        return (
            <div
                className={`${getButtonContainerClasses(variant)} cta-motion`}
                style={getCtaStyle(variant, buttonVisible, buttonScale)}
            >
                <a
                    href={cta.href}
                    target={cta.isExternal ? '_blank' : undefined}
                    rel={cta.isExternal ? 'noopener noreferrer' : undefined}
                    onClick={cta.onClick}
                >
                    <Button
                        shadowSize="4"
                        icon={cta.icon}
                        className="bg-white px-7 py-3 text-base font-extrabold hover:bg-white/90 md:px-9 md:py-8 md:text-xl"
                    >
                        {cta.label}
                    </Button>
                </a>
                {cta.subtext && (
                    <span className="mt-2 block text-center text-sm text-n-1 italic md:text-base">{cta.subtext}</span>
                )}
            </div>
        )
    }

    const renderCustomCta = () => (
        <div
            className={`${getButtonContainerClasses('primary')} cta-motion`}
            style={getCtaStyle('primary', buttonVisible, buttonScale)}
        >
            {customCta}
        </div>
    )

    return (
        <section
            id="hero"
            className="relative flex min-h-[85vh] w-full flex-col items-center justify-between bg-primary-1 px-4 pt-4 pb-12 md:pb-16 xl:h-fit xl:justify-center xl:pb-4"
        >
            <CloudsCss clouds={heroClouds} className="md:hidden" />
            <CloudsCss className="hidden md:block" />
            <div className="relative mt-10 w-full md:mt-0">
                {/* 23rem = the fixed stack below the artwork (h2 -> CTA) + 3rem slack, so the CTA stays inside the first fold on short laptop viewports */}
                <Image
                    src={GlobalCashLocalFeel}
                    preload
                    sizes="(min-width: 768px) 50vw, 100vw"
                    className="z-0 mx-auto h-auto max-h-[calc(100svh-23rem)] w-full max-w-[1000px] object-contain md:w-[50%]"
                    alt="Global Cash Local Feel"
                />

                <AnimateOnView
                    className="absolute bottom-[-4%] left-[1%] w-8 sm:bottom-[11%] sm:left-[12%] md:bottom-[18%] md:left-[5%] md:w-12"
                    y="20px"
                    x="5px"
                >
                    <Image src={Star} alt="" />
                </AnimateOnView>
                <AnimateOnView
                    className="absolute top-[-12%] right-[1.5%] w-8 sm:top-[8%] sm:right-[6%] md:top-[8%] md:right-[5%] md:w-12 lg:right-[10%]"
                    y="28px"
                    x="-5px"
                >
                    <Image src={Star} alt="" />
                </AnimateOnView>
            </div>
            <PeanutMascot />

            <div className="relative z-20 flex w-full flex-col items-center justify-center">
                {/* Short phone viewports only: the pt-BR headline wraps to 3 lines (and to 4 below
                    360px) where en/es take 2, which pushes the CTA under the fold. Buy the 38-76px
                    back from this gap rather than from the artwork, so every locale keeps the same
                    hero on normal screens. Width-scoped too, or it would fire on 1366x657 laptops. */}
                <h2 className="font-roboto-flex-extrabold mt-18 text-center text-[2.375rem] font-extraBlack text-black md:mt-12 md:text-heading [@media(max-height:660px)_and_(max-width:767px)]:mt-4">
                    {strings.heroTapScan}
                </h2>
                <span
                    className="mt-2 block text-center text-xl leading-tight text-n-1 md:mt-4 md:text-5xl"
                    style={{ fontWeight: 500, letterSpacing: '-0.5px' }}
                >
                    <Link prefetch={false} href={`/${locale}/argentina`} className="hover:underline">
                        Buenos Aires
                    </Link>
                    .{' '}
                    <Link prefetch={false} href={`/${locale}/brazil`} className="hover:underline">
                        São Paulo
                    </Link>
                    .{' '}
                    <Link prefetch={false} href={`/${locale}/brazil`} className="hover:underline">
                        Floripa
                    </Link>
                    .
                </span>
                <span className="mt-2 block text-center text-sm text-n-1/70 md:text-base" style={{ fontWeight: 400 }}>
                    {strings.heroNoLocalId}
                </span>
                {primaryCta ? renderCTAButton(primaryCta, 'primary') : customCta ? renderCustomCta() : null}
                {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}
                {/* Returning users with an expired session had no way back in from the
                    marketing site: every CTA pointed at signup. `?step=login` lands on
                    the passkey Log In step (setup-entry.ts). */}
                <Link
                    prefetch={false}
                    href="/setup?step=login"
                    className="mt-4 block text-center text-body-s text-n-1 underline"
                >
                    {strings.logIn}
                </Link>
                <AnimateOnView
                    className="absolute bottom-[-4%] left-[1%] w-8 sm:bottom-[11%] sm:left-[12%] md:bottom-[18%] md:left-[5%] md:w-12"
                    y="20px"
                    x="5px"
                >
                    <Image src={Star} alt="" />
                </AnimateOnView>
                <AnimateOnView
                    className="absolute top-[-12%] right-[1.5%] w-8 sm:top-[8%] sm:right-[6%] md:top-[8%] md:right-[5%] md:w-12 lg:right-[10%]"
                    y="28px"
                    x="-5px"
                >
                    <Image src={Star} alt="" />
                </AnimateOnView>
            </div>
        </section>
    )
}
