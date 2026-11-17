'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import PeanutMascot from '@/components/Global/PeanutMascot'
import OnboardingAnimation from './OnboardingAnimation'
import { ResidenceHero } from '@/components/Setup/components/ResidenceHero'
import type { ScreenId } from '@/components/Setup/Setup.types'
import { twMerge } from '@/utils/tw'
import { DESKTOP_HERO_ART } from './desktopHero.consts'

// dev's hero art drift: the old art leaves the way the panel goes while the new art drifts in, both fading
const artVariants = {
    enter: (direction: number) => ({ x: direction < 0 ? '-30%' : '30%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? '30%' : '-30%', opacity: 0 }),
}
const ART_TRANSITION = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const

/**
 * Dev's desktop side hero (origin/dev c985d250e `SetupWrapper` ImageSection): the full-height blue panel left of the
 * sign-up column, with the step's dev art, the landing's clouds and the username step's "@" signs. The hero stays put
 * between steps; its art crossfades. Desktop only: SetupShell mounts it at `md` and up.
 */
export function SetupDesktopHero({
    screenId,
    direction,
    reduced,
}: {
    screenId: ScreenId
    direction: number
    reduced: boolean
}) {
    const t = useTranslations('setup.wrapper')
    const art = DESKTOP_HERO_ART[screenId]
    const transition = reduced ? { duration: 0 } : ART_TRANSITION
    const artKey = art ? ('pose' in art ? art.pose : 'animation' in art ? art.animation : art.hero) : 'none'

    return (
        <div
            data-setup-hero
            aria-hidden="true"
            className="relative flex h-full w-7/12 shrink-0 items-center justify-center overflow-hidden bg-background-setup-hero px-6"
        >
            <AnimatePresence initial={false} custom={direction}>
                {screenId === 'landing' && (
                    <motion.div
                        key="landing-clouds"
                        variants={artVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition}
                        className="pointer-events-none absolute inset-0"
                    >
                        <CloudsBackground minimal />
                    </motion.div>
                )}
                {screenId === 'signup' && (
                    <motion.div
                        key="username-background"
                        variants={artVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition}
                        className="pointer-events-none absolute inset-0"
                    >
                        <OnboardingAnimation name="username" background />
                    </motion.div>
                )}
            </AnimatePresence>
            <AnimatePresence initial={false} custom={direction}>
                {art && (
                    <motion.div
                        key={artKey}
                        variants={artVariants}
                        custom={direction}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={transition}
                        className={twMerge(
                            'absolute inset-x-0 flex items-center justify-center',
                            'hero' in art ? 'inset-y-0' : 'top-20 bottom-8'
                        )}
                    >
                        {'pose' in art ? (
                            <PeanutMascot
                                pose={art.pose}
                                alt={t('illustrationAlt')}
                                className={twMerge(
                                    'relative h-full max-w-full',
                                    // dev kept the welcome and username mascots at the same height
                                    (screenId === 'landing' || screenId === 'signup') && 'scale-[0.8]'
                                )}
                            />
                        ) : 'animation' in art ? (
                            <OnboardingAnimation name={art.animation} />
                        ) : (
                            <ResidenceHero alt={t('illustrationAlt')} />
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
