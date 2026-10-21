'use client'

import PeanutMascot from '@/components/Global/PeanutMascot'
import { Star } from '@/assets/illustrations'
import Link from 'next/link'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import Image from 'next/image'
import { type CSSProperties } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Title } from '@/components/0_Bruddle/Title'
import { CloudsCss, type CloudConfig } from './CloudsCss'
import { AnimateOnView } from '@/components/Global/AnimateOnView'
import type { LandingStrings } from './landingStrings'
import { type CTAButton } from '@/components/LandingPage/landing.types'
import { CTA_MOTION } from '@/components/Marketing/constants'
import { useHeroLayout } from './useHeroLayout'
import styles from './hero.module.css'

// Phone cloud bands stop above the CTA, where a white cloud would hide the white pill.
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

// The sticky footer takes over when the hero CTA fades and parks out of the way.
const getCtaStyle = (buttonVisible?: boolean): CSSProperties =>
    ({
        '--cta-x': buttonVisible ? '0px' : '20px',
        '--cta-y': buttonVisible ? '0px' : '20px',
        '--cta-r': buttonVisible ? '0deg' : '1deg',
        opacity: buttonVisible ? 1 : 0,
        pointerEvents: buttonVisible ? 'auto' : 'none',
    }) as CSSProperties

const getButtonContainerClasses = (variant: 'primary' | 'secondary') =>
    `${styles.cta} relative z-20 flex flex-col items-center justify-center transition-opacity duration-slow ${variant === 'primary' ? 'mx-auto' : 'right-[calc(50%-120px)]'}`

export function Hero({ primaryCta, secondaryCta, buttonVisible, customCta, strings }: HeroProps) {
    const migrationOn = useMigrationFlag()
    const headline = `${strings.heroGetPaid} ${strings.heroGlobally}. ${strings.heroSpend} ${strings.heroLocally}.`
    const { heroRef, headlineRef, copyRef } = useHeroLayout(headline)

    const renderCTAButton = (cta: CTAButton, variant: 'primary' | 'secondary') => (
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

    return (
        <section ref={heroRef} id="hero" className={`${styles.hero} bg-background-brand text-foreground-primary`}>
            <CloudsCss clouds={heroClouds} className={`${styles.phoneClouds} md:hidden`} />
            <CloudsCss className={`${styles.desktopClouds} hidden md:block`} />
            <div className={styles.scene}>
                <h1 ref={headlineRef} className={styles.headline}>
                    <span className="sr-only">{headline}</span>
                    <span className={styles.phrase} data-hero-phrase="" aria-hidden>
                        <span className={`${styles.label} font-roboto-flex-extrabold font-extraBlack`}>
                            {strings.heroGetPaid}
                        </span>
                        <span className={styles.accentWrap}>
                            <Title text={strings.heroGlobally} className={styles.accent} />
                        </span>
                    </span>
                    <span className={styles.phrase} data-hero-phrase="" aria-hidden>
                        <span className={`${styles.label} font-roboto-flex-extrabold font-extraBlack`}>
                            {strings.heroSpend}
                        </span>
                        <span className={styles.accentWrap}>
                            <Title text={strings.heroLocally} className={styles.accent} />
                        </span>
                    </span>
                </h1>
                <AnimateOnView className={`${styles.star} ${styles.starOne}`} y="20px" x="5px">
                    <Image src={Star} alt="" />
                </AnimateOnView>
                <AnimateOnView className={`${styles.star} ${styles.starTwo}`} y="28px" x="-5px">
                    <Image src={Star} alt="" />
                </AnimateOnView>
            </div>
            <div className={styles.mascot}>
                <PeanutMascot pose="waving-chill" alt="Peanut Guy" className="size-full" />
            </div>
            <div ref={copyRef} className={styles.copy}>
                <p className={styles.subtitle}>
                    <span>{strings.heroReceiveCurrencies}</span> <span>{strings.heroPayMethods}</span>
                </p>
                {primaryCta ? (
                    renderCTAButton(primaryCta, 'primary')
                ) : customCta ? (
                    <div className={getButtonContainerClasses('primary')} style={getCtaStyle(buttonVisible)}>
                        {customCta}
                    </div>
                ) : null}
                {secondaryCta && renderCTAButton(secondaryCta, 'secondary')}
                {!migrationOn && (
                    <Link
                        prefetch={false}
                        href="/setup?step=login"
                        className={`${styles.login} block text-center text-body-s text-foreground-primary underline`}
                    >
                        {strings.logIn}
                    </Link>
                )}
                <AnimateOnView className={`${styles.star} ${styles.starThree}`} y="20px" x="5px">
                    <Image src={Star} alt="" />
                </AnimateOnView>
                <AnimateOnView className={`${styles.star} ${styles.starFour}`} y="28px" x="-5px">
                    <Image src={Star} alt="" />
                </AnimateOnView>
            </div>
        </section>
    )
}
