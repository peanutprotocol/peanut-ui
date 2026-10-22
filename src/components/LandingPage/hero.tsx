'use client'

import PeanutMascot from '@/components/Global/PeanutMascot'
import { MASCOT_ART_FILL } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { Star } from '@/assets/illustrations'
import Link from 'next/link'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import Image from 'next/image'
import { useEffect, useCallback, useRef, type CSSProperties } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { CloudsCss, type CloudConfig } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import type { LandingStrings } from './landingStrings'
import { type CTAButton } from '@/components/LandingPage/landing.types'
import { CTA_MOTION } from '@/components/Marketing/constants'

/**
 * Peanut mascot that positions itself so only 6% of its height (the feet)
 * overlaps with the h1 subtitle below. Measures the h1 position on mount
 * and resize, then sets its own bottom edge to sit 6% into the h1.
 */
function HeroMascot() {
    const hostRef = useRef<HTMLDivElement>(null)

    const position = useCallback(() => {
        const host = hostRef.current
        const hero = document.getElementById('hero')
        const h1 = hero?.querySelector('h1')
        if (!host || !hero || !h1) return

        const heroRect = hero.getBoundingClientRect()
        const h1Rect = h1.getBoundingClientRect()
        const hostHeight = host.getBoundingClientRect().height

        if (hostHeight === 0) return // not rendered yet

        const peanutHeight = hostHeight * MASCOT_ART_FILL
        const footPadding = (hostHeight - peanutHeight) / 2

        // Position so peanut's feet (bottom 3%) overlap with h1 top
        const overlap = peanutHeight * 0.06
        const peanutBottom = h1Rect.top - heroRect.top + overlap
        const peanutTop = peanutBottom - peanutHeight - footPadding

        host.style.top = `${peanutTop}px`
    }, [])

    useEffect(() => {
        position()
        const settle = setTimeout(position, 500)
        window.addEventListener('resize', position)
        return () => {
            clearTimeout(settle)
            window.removeEventListener('resize', position)
        }
    }, [position])

    return (
        <div
            ref={hostRef}
            className="absolute left-1/2 z-10 h-[40vh] w-[90%] -translate-x-1/2 md:h-[min(40vh,calc(100svh-28rem))]"
        >
            <PeanutMascot pose="waving-chill" alt="Peanut Guy" className="size-full" />
        </div>
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
    primaryCta?: CTAButton
    secondaryCta?: CTAButton
    buttonVisible?: boolean
    /** replaces the primary button entirely (store-button pair on desktop during the migration window) */
    customCta?: React.ReactNode
}

/*
 * The CTA fades out while the footer is on screen (the sticky bar takes over).
 * The holder parks the CTA_MOTION button off its rest position through the
 * --cta-* custom properties `.cta-motion` reads, so it slides as it fades.
 */
const getCtaStyle = (buttonVisible?: boolean): CSSProperties =>
    ({
        '--cta-x': buttonVisible ? '0px' : '20px',
        '--cta-y': buttonVisible ? '0px' : '20px',
        '--cta-r': buttonVisible ? '0deg' : '1deg',
        opacity: buttonVisible ? 1 : 0,
        pointerEvents: buttonVisible ? 'auto' : 'none',
    }) as CSSProperties

const getButtonContainerClasses = (variant: 'primary' | 'secondary') =>
    `relative z-20 mt-8 flex flex-col items-center justify-center transition-opacity duration-slow ${variant === 'primary' ? 'mx-auto' : 'right-[calc(50%-120px)]'}`

export function Hero({ primaryCta, secondaryCta, buttonVisible, customCta, strings }: HeroProps) {
    const migrationOn = useMigrationFlag()
    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => {
        return (
            <div className={getButtonContainerClasses(variant)} style={getCtaStyle(buttonVisible)}>
                <Button
                    size="large"
                    variant="secondary"
                    icon={cta.icon}
                    href={cta.href}
                    plainAnchor
                    external={cta.isExternal}
                    onClick={cta.onClick}
                    className={`w-fit ${CTA_MOTION}`}
                >
                    {cta.label}
                </Button>
                {cta.subtext && (
                    <span className="mt-2 block text-center text-body-s text-foreground-primary italic md:text-body-m">
                        {cta.subtext}
                    </span>
                )}
            </div>
        )
    }

    const renderCustomCta = () => (
        <div className={getButtonContainerClasses('primary')} style={getCtaStyle(buttonVisible)}>
            {customCta}
        </div>
    )

    return (
        <section
            id="hero"
            className="relative flex min-h-[85vh] w-full flex-col items-center justify-between bg-background-brand px-6 pt-4 pb-12 md:px-4 md:pb-16 xl:h-fit xl:justify-center xl:pb-4"
        >
            <CloudsCss clouds={heroClouds} className="md:hidden" />
            <CloudsCss className="hidden md:block" />
            <div className="relative mt-10 w-full md:mt-0">
                <div aria-hidden className="h-[32vh] max-h-80" />

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
            <HeroMascot />

            <div className="relative z-20 flex w-full flex-col items-center justify-center">
                <h1 className="font-roboto-flex-extrabold mt-16 max-w-4xl text-center text-[2.375rem] font-extraBlack text-foreground-primary md:mt-12 md:text-heading [@media(max-height:660px)_and_(max-width:767px)]:mt-4">
                    {strings.heroHeadline}
                </h1>
                <p className="mt-2 max-w-3xl text-center text-xl leading-tight text-foreground-primary md:mt-4 md:text-3xl">
                    {strings.heroSubline}
                </p>
                {primaryCta ? renderCTAButton(primaryCta, 'primary') : customCta ? renderCustomCta() : null}
                {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}
                {/* Web login remains available until migration moves authentication into the app. */}
                {!migrationOn && (
                    <Link
                        prefetch={false}
                        href="/setup?step=login"
                        className="mt-4 block text-center text-body-s text-foreground-primary underline"
                    >
                        {strings.logIn}
                    </Link>
                )}
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
