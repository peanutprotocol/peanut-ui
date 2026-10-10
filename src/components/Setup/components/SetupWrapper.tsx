import OnboardingAnimation from './OnboardingAnimation'
import { SetupLanguageSwitcher } from './SetupLanguageSwitcher'
import SetupTitleBlock from './SetupTitleBlock'
import { Button } from '@/components/0_Bruddle/Button'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { PeanutMascotScene } from '@/components/Global/PeanutMascot/PeanutMascotScene'
import { type LayoutType, type ScreenId, type SetupIllustration } from '@/components/Setup/Setup.types'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
import { useFirstLaunchIntro } from '@/hooks/useFirstLaunchIntro'
import { useMigrationFlag } from '@/hooks/useMigrationFlag'
import { isCapacitor } from '@/utils/capacitor'
import { AnimatePresence, motion, useIsPresent, useReducedMotion } from 'framer-motion'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import {
    type ReactNode,
    createContext,
    memo,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { twMerge } from '@/utils/tw'

const SetupFullScreenContext = createContext<(enabled: boolean) => void>(() => {})

/** Residence outcomes share a step but need their own full-page layout. */
export const useSetupFullScreen = (enabled: boolean) => {
    const setFullScreen = useContext(SetupFullScreenContext)
    useLayoutEffect(() => {
        setFullScreen(enabled)
        return () => setFullScreen(false)
    }, [enabled, setFullScreen])
}

/**
 * props interface for the SetupWrapper component
 * defines the structure and configuration options for the setup flow
 */
interface SetupWrapperProps {
    layoutType: LayoutType
    screenId: ScreenId
    children: ReactNode
    image?: SetupIllustration
    imageClassName?: HTMLDivElement['className']
    title?: ReactNode
    description?: ReactNode
    /** Sell screens lead with the larger heading. */
    titleSize?: 's' | 'm'
    /** The description continues the heading as a second statement. */
    descriptionInTitle?: boolean
    contentClassName?: HTMLDivElement['className']
    titleClassName?: HTMLDivElement['className']
    showBackButton?: boolean
    showSkipButton?: boolean
    showLogoutButton?: boolean
    onBack?: () => void
    onSkip?: () => void
    onLogout?: () => void
    isLoggingOut?: boolean
    step?: number
    direction?: number
    /** Isolated Screen Library presentation; never reads or writes install state. */
    firstLaunchIntroPreview?: 'play' | 'still'
    fullScreen?: boolean
    showProgress?: boolean
}

// One hero height per viewport, the same on every step (`.setup-hero-height` in
// globals.css): the tallest step's copy decides how much room the hero leaves,
// so nothing jumps when the step changes. Desktop keeps the full-height side hero.
const IMAGE_CONTAINER_CLASSES: Record<LayoutType, string> = {
    signup: 'setup-hero-height shrink-0 md:h-dvh',
}

const SETUP_HERO_BACKGROUND = 'var(--color-background-setup-hero)'

/** The older Android OS status bar needs the blue token as a hex value. */
const setupHeroNativeHex = (fullScreen: boolean): string | null => {
    const color = getComputedStyle(document.documentElement)
        .getPropertyValue(fullScreen ? '--color-background-default' : '--color-background-setup-hero')
        .trim()
    return /^#[\da-f]{6}$/i.test(color) ? color : null
}

const stepVariants = {
    enter: (direction: number) => ({ x: direction < 0 ? '-100%' : '100%' }),
    center: { x: 0 },
    exit: (direction: number) => ({ x: direction < 0 ? '100%' : '-100%' }),
}

// The blue hero stays put between steps; its art moves and fades at once: the
// old art drifts out the way the panel goes while the new art drifts in, both
// fading, overlapping (Hugo, 2026-10-10). Short drift, so nothing reaches the
// hero's edge before it is gone.
const artVariants = {
    enter: (direction: number) => ({ x: direction < 0 ? '-30%' : '30%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? '30%' : '-30%', opacity: 0 }),
}
const ART_TRANSITION = { duration: 0.24, ease: [0.22, 1, 0.36, 1] } as const

const STEP_TRANSITION = { duration: 0.5, ease: [0.22, 1, 0.36, 1] } as const

const TransitioningContent = ({
    children,
    className,
    direction,
    prefersReducedMotion,
}: {
    children: ReactNode
    className: string
    direction: number
    prefersReducedMotion: boolean
}) => {
    const isPresent = useIsPresent()
    // An exiting screen must not stretch the incoming screen's footer, then
    // move its CTA when AnimatePresence removes the taller outgoing page.
    return (
        <motion.div
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={prefersReducedMotion ? { duration: 0 } : STEP_TRANSITION}
            className={twMerge(className, !isPresent && 'pointer-events-none absolute inset-0')}
            aria-hidden={!isPresent}
            inert={!isPresent}
        >
            {children}
        </motion.div>
    )
}

/**
 * The top bar: back on the left; skip, logout and the language switcher on the
 * right. It sits outside the sliding step content, so nothing in it moves when
 * the user changes step, and the back slot keeps its width when a step has no
 * back button.
 */
const Navigation = memo(function Navigation({
    showBackButton,
    showSkipButton,
    showLogoutButton,
    showLanguageSwitcher,
    onBack,
    onSkip,
    onLogout,
    isLoggingOut,
}: Pick<
    SetupWrapperProps,
    'showBackButton' | 'showSkipButton' | 'showLogoutButton' | 'onBack' | 'onSkip' | 'onLogout' | 'isLoggingOut'
> & { showLanguageSwitcher: boolean }) {
    const t = useTranslations('setup.navigation')

    if (!showBackButton && !showSkipButton && !showLogoutButton && !showLanguageSwitcher) return null

    // Icons inherit currentColor: the circle fills on hover/active, and a
    // hard-coded fill vanished into the fill colour.
    // The row's containing block is the initial one (no positioned ancestor).
    // Match app navigation at 16px from either horizontal edge and 16px below
    // the safe-area boundary; on web --safe-top is zero.
    return (
        <div
            data-setup-top-bar
            className="absolute top-[calc(var(--safe-top)_+_1rem)] z-20 flex w-full items-center justify-between px-4"
        >
            <div className="size-10 shrink-0">
                {showBackButton && (
                    <Button
                        variant="ghost"
                        onClick={onBack}
                        className={NAV_CIRCLE_BUTTON_CLASSES}
                        aria-label={t('goBack')}
                    >
                        <Icon name="chevron-up" size={20} className="-rotate-90" />
                    </Button>
                )}
            </div>
            <div className="flex items-center gap-3">
                {showSkipButton && (
                    <Button
                        onClick={onSkip}
                        variant="ghost"
                        className="relative h-auto w-fit p-0 after:absolute after:-inset-3"
                    >
                        <span className="text-foreground-over-color-secondary">{t('skip')}</span>
                    </Button>
                )}
                {showLogoutButton && (
                    <Button
                        onClick={onLogout}
                        loading={isLoggingOut}
                        variant="ghost"
                        className={NAV_CIRCLE_BUTTON_CLASSES}
                        aria-label={t('logout')}
                        disabled={isLoggingOut}
                    >
                        <Icon name="logout" size={20} />
                    </Button>
                )}
                {showLanguageSwitcher && <SetupLanguageSwitcher />}
            </div>
        </div>
    )
})

function UsernameBackground() {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-username-background>
            <OnboardingAnimation name="username" background />
        </div>
    )
}

/**
 * ImageSection component handles the illustrations and animations
 * renders differently based on layout type with optional animated decorations
 */
const ImageSection = ({
    layoutType,
    image,
    screenId,
    imageClassName,
    direction = 0,
    prefersReducedMotion,
    intro,
}: Pick<SetupWrapperProps, 'layoutType' | 'image' | 'screenId' | 'imageClassName' | 'direction'> & {
    prefersReducedMotion: boolean
    intro: ReturnType<typeof useFirstLaunchIntro>
}) => {
    const t = useTranslations('setup.wrapper')
    const introPresentation = intro.active || intro.played
    const [introLayout, setIntroLayout] = useState<{ viewport: number; available: number; resting: number } | null>(
        null
    )
    useLayoutEffect(() => {
        if (!introPresentation) return
        const measure = () => {
            const styles = getComputedStyle(document.documentElement)
            const viewport = window.innerHeight
            const safeTop = parseFloat(styles.getPropertyValue('--safe-top')) || 0
            const safeBottom = parseFloat(styles.getPropertyValue('--safe-bottom')) || 0
            // The hero settles at the same height every step uses (the CSS class), measured once here.
            const probe = document.createElement('div')
            probe.className = 'setup-hero-height'
            probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
            document.body.appendChild(probe)
            const resting = window.innerWidth < 768 ? probe.getBoundingClientRect().height : viewport
            probe.remove()
            setIntroLayout({ viewport, available: viewport - safeTop - safeBottom, resting })
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [introPresentation])
    const restingHeight = introLayout?.resting ?? 0

    if (!image) return null

    const isSignup = layoutType === 'signup'
    const containerClass = IMAGE_CONTAINER_CLASSES[layoutType]
    const imageKey =
        'pose' in image
            ? image.pose
            : 'scene' in image
              ? image.scene
              : 'animation' in image
                ? image.animation
                : image.src
    const illustration =
        'pose' in image ? (
            <PeanutMascot
                pose={image.pose}
                onReady={intro.onMascotReady}
                alt={t('illustrationAlt')}
                className={twMerge(
                    imageClassName || 'relative h-full max-w-full',
                    // Keep the welcome and username mascots at the same height.
                    (screenId === 'landing' || screenId === 'signup') && 'scale-[0.8]'
                )}
            />
        ) : 'scene' in image ? (
            <PeanutMascotScene
                scene={image.scene}
                className={
                    image.scene === 'coins'
                        ? 'top-4 h-56 scale-150 md:top-0 md:h-64 md:scale-200'
                        : 'scale-150 md:scale-200'
                }
                mascotClassName={image.scene === 'coins' ? 'h-56 md:h-64' : undefined}
            />
        ) : 'animation' in image ? (
            <OnboardingAnimation name={image.animation} />
        ) : (
            <Image
                src={image.src}
                alt={t('illustrationAlt')}
                width={500}
                height={500}
                className={
                    imageClassName ||
                    'relative max-h-[85%] w-full max-w-[80%] object-contain md:max-w-[75%] lg:max-w-xl'
                }
                priority
            />
        )
    const animatedIllustration = (
        <AnimatePresence initial={false} custom={direction}>
            <motion.div
                key={imageKey}
                variants={artVariants}
                custom={direction}
                initial="enter"
                exit="exit"
                animate={
                    intro.played && introLayout
                        ? {
                              top: intro.active ? (introLayout.available - introLayout.viewport * 0.44) / 2 : 64,
                              height: intro.active ? introLayout.viewport * 0.44 : restingHeight - 72,
                              opacity: intro.phase === 'checking' ? 0 : 1,
                              x: 0,
                          }
                        : 'center'
                }
                transition={
                    prefersReducedMotion
                        ? { duration: 0 }
                        : intro.played
                          ? { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
                          : ART_TRANSITION
                }
                className={twMerge(
                    'absolute inset-x-0 flex items-center justify-center',
                    intro.active && !intro.played && 'invisible top-[calc(50%_-_22dvh)] h-[44dvh]',
                    !introPresentation &&
                        ('animation' in image
                            ? 'top-14 bottom-1 md:top-20 md:bottom-8'
                            : 'top-16 bottom-2 md:top-20 md:bottom-8')
                )}
            >
                {illustration}
            </motion.div>
        </AnimatePresence>
    )

    // special rendering for welcome/signup screens with animated decorations
    if (isSignup) {
        return (
            <motion.div
                data-setup-hero
                initial={false}
                animate={
                    intro.played && introLayout
                        ? { height: intro.active ? introLayout.available : restingHeight }
                        : undefined
                }
                transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                className={twMerge(
                    containerClass,
                    'setup-hero-background relative flex w-full flex-row items-center justify-center overflow-hidden px-4 transition-colors duration-fast ease-in-out motion-reduce:transition-none md:h-dvh md:w-7/12 md:px-6',
                    intro.active && 'h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] md:w-full'
                )}
            >
                {/* Per-step backgrounds move with the art: clouds on the landing
                    screen only, so later illustrations stay clear, and the "@" signs on
                    the username step. */}
                <AnimatePresence initial={false} custom={direction}>
                    {screenId === 'landing' && !intro.active && (
                        <motion.div
                            key="landing-clouds"
                            variants={artVariants}
                            custom={direction}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={prefersReducedMotion ? { duration: 0 } : ART_TRANSITION}
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
                            transition={prefersReducedMotion ? { duration: 0 } : ART_TRANSITION}
                            className="pointer-events-none absolute inset-0"
                        >
                            <UsernameBackground />
                        </motion.div>
                    )}
                </AnimatePresence>
                {animatedIllustration}
                <AnimatePresence>
                    {intro.active && intro.greetingVisible && (
                        <motion.div
                            key="intro-greeting"
                            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
                            className="absolute inset-x-0 top-[calc(50%_+_16dvh)] px-6 text-center text-heading-s"
                            role="status"
                        >
                            {t('introGreeting')}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        )
    }

    // standard layout rendering without decorations
    return (
        <div
            className={twMerge(
                containerClass,
                'relative flex w-full flex-row items-center justify-center overflow-hidden transition-colors duration-fast ease-in-out motion-reduce:transition-none md:h-dvh md:w-7/12',
                'setup-hero-background'
            )}
        >
            {animatedIllustration}
        </div>
    )
}

/**
 * main SetupWrapper component
 * provides a responsive layout structure for setup/onboarding screens
 * uses dynamic viewport height (dvh) for better mobile browser compatibility
 */
export const SetupWrapper = memo(function SetupWrapper({
    layoutType,
    children,
    image,
    title,
    description,
    titleSize = 's',
    descriptionInTitle = false,
    contentClassName,
    showBackButton,
    showSkipButton,
    showLogoutButton,
    onBack,
    onSkip,
    onLogout,
    isLoggingOut,
    screenId,
    imageClassName,
    titleClassName,
    step,
    direction = 0,
    firstLaunchIntroPreview,
    fullScreen: fullScreenProp = false,
    showProgress = true,
}: SetupWrapperProps) {
    const [fullScreenOverride, setFullScreenOverride] = useState<ScreenId | null>(null)
    const setFullScreenForScreen = useCallback(
        (enabled: boolean) =>
            setFullScreenOverride((current) => (enabled ? screenId : current === screenId ? null : current)),
        [screenId]
    )
    const fullScreen = fullScreenProp || fullScreenOverride === screenId
    const prefersReducedMotion = useReducedMotion()
    const intro = useFirstLaunchIntro(screenId === 'landing', firstLaunchIntroPreview)
    const previousStep = useRef(step)
    const transitionDirection =
        step !== undefined && previousStep.current !== undefined && step !== previousStep.current
            ? step > previousStep.current
                ? 1
                : -1
            : direction
    useLayoutEffect(() => {
        previousStep.current = step
    }, [step])
    useLayoutEffect(() => {
        // Safe-area strips follow the full-page checklist/celebration or blue hero.
        document.documentElement.style.setProperty(
            '--setup-hero-background',
            fullScreen ? 'var(--color-background-default)' : SETUP_HERO_BACKGROUND
        )
        return () => {
            document.documentElement.style.removeProperty('--setup-hero-background')
        }
    }, [fullScreen])
    useEffect(() => {
        if (!isCapacitor()) return
        let cancelled = false
        const color = setupHeroNativeHex(fullScreen)
        if (!color) return
        void import('@capacitor/status-bar')
            .then(async ({ StatusBar }) => {
                if (!cancelled) await StatusBar.setBackgroundColor({ color })
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [fullScreen])
    const migrationOn = useMigrationFlag()
    const hasKeepWebBypass = useKeepWebBypass()
    // migration notice window's download-only landing: drop the fixed-height
    // title block (it left a big gap above the QR) and center the copy on
    // desktop to match the centered store content. legacy landing untouched.
    const sunsetLanding = screenId === 'landing' && migrationOn && !isCapacitor() && !hasKeepWebBypass

    // Slide the white panel up on first paint for a native bottom-sheet feel.
    // Mobile + landing only; read synchronously so the offset is correct on mount.
    const [slideUpPanel] = useState(
        () => screenId === 'landing' && typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
    )
    const animatePanelIn = slideUpPanel && screenId === 'landing' && !prefersReducedMotion

    return (
        <div
            data-first-launch-intro={intro.active ? intro.phase : undefined}
            className={twMerge(
                'flex min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] flex-col overflow-x-hidden overflow-y-auto bg-white',
                // The first panel rises from below the viewport. Fill the exposed
                // space with the same blue as the hero, not the page beige.
                screenId === 'landing' && 'bg-background-setup-hero',
                fullScreen && 'bg-background-default',
                intro.active && 'h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] overflow-y-hidden'
            )}
        >
            {/* navigation buttons */}
            <Navigation
                showBackButton={showBackButton}
                showSkipButton={showSkipButton}
                showLogoutButton={showLogoutButton}
                // Hidden during the first-launch intro, and on a full-page step without progress (the celebration).
                showLanguageSwitcher={!intro.active && (!fullScreen || showProgress)}
                onBack={onBack}
                onSkip={onSkip}
                onLogout={onLogout}
                isLoggingOut={isLoggingOut}
            />

            {/* The hero stays put between steps (its art crossfades); only the white
                panel below slides. */}
            <div
                className={twMerge(
                    'flex min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] min-w-0 flex-1 flex-col',
                    !fullScreen && 'max-md:h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] md:flex-row'
                )}
            >
                {!fullScreen && (
                    <ImageSection
                        imageClassName={imageClassName}
                        screenId={screenId}
                        layoutType={layoutType}
                        image={image}
                        direction={transitionDirection}
                        prefersReducedMotion={!!prefersReducedMotion}
                        intro={intro}
                    />
                )}
                {/* Stack complete panels so the incoming slide covers the outgoing one without a blank frame. */}
                <div className="relative grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-x-hidden">
                    <AnimatePresence initial={false} custom={transitionDirection} mode="sync">
                        <TransitioningContent
                            key={screenId}
                            direction={transitionDirection}
                            prefersReducedMotion={!!prefersReducedMotion}
                            className="col-start-1 row-start-1 mx-auto flex w-full min-w-0 flex-col bg-white"
                        >
                            {fullScreen && showProgress && (
                                // Keeps the content clear of the fixed top bar.
                                <div aria-hidden="true" className="my-4 h-11 shrink-0" />
                            )}

                            {/* content section */}
                            <motion.div
                                initial={animatePanelIn ? { y: '100%' } : false}
                                animate={intro.active ? { y: '100%' } : { y: 0 }}
                                transition={
                                    prefersReducedMotion
                                        ? { duration: 0 }
                                        : intro.played
                                          ? { duration: 0.8, ease: [0.22, 1, 0.36, 1] }
                                          : { type: 'spring', stiffness: 260, damping: 30 }
                                }
                                aria-hidden={intro.active}
                                inert={intro.active}
                                className={twMerge(
                                    // The footer's reserved secondary slot keeps the primary CTA clear of the
                                    // home gesture area, so the panel needs only pb-6 above the safe-area inset.
                                    'flex min-h-0 flex-1 flex-col justify-between overflow-x-hidden overflow-y-auto bg-white px-6 pt-10 pb-6 md:h-dvh compact:pt-6 compact:pb-4 short:pt-4 short:pb-3 tight:pt-3 tight:pb-2',

                                    fullScreen && 'md:h-auto md:flex-1'
                                )}
                            >
                                <div
                                    className={twMerge(
                                        'flex w-full flex-1 flex-col justify-between md:flex-1',
                                        contentClassName,
                                        'gap-8 compact:gap-5 short:gap-4 tight:gap-3',
                                        // signup matches residence: the field sits 24px under the description
                                        screenId === 'signup' && 'gap-6 compact:gap-5 short:gap-4 tight:gap-3',
                                        !sunsetLanding && 'md:flex-1 md:justify-between',
                                        fullScreen && 'flex-1 items-stretch md:flex-1 md:justify-between'
                                    )}
                                >
                                    {/* Renders nothing when the step owns its heading (titleInView +
                                    descriptionInView): an empty, height-capped slot would push
                                    the content down on desktop. */}
                                    <SetupTitleBlock
                                        title={title}
                                        description={description}
                                        size={titleSize}
                                        descriptionInTitle={descriptionInTitle}
                                        className={twMerge(
                                            'md:max-h-48 md:max-w-xs',
                                            screenId === 'join-beta' && 'md:max-h-12',
                                            (sunsetLanding || titleSize === 'm') && 'md:h-auto md:max-h-none'
                                        )}
                                        titleClassName={twMerge(sunsetLanding && 'md:text-center', titleClassName)}
                                        descriptionClassName={sunsetLanding ? 'md:text-center' : undefined}
                                    />
                                    {/* main content area */}
                                    <div
                                        className={twMerge(
                                            'mx-auto w-full',
                                            fullScreen ? 'flex flex-1 flex-col md:max-w-md' : 'md:max-w-xs',
                                            !sunsetLanding && 'flex flex-1 flex-col'
                                        )}
                                    >
                                        <SetupFullScreenContext.Provider value={setFullScreenForScreen}>
                                            {children}
                                        </SetupFullScreenContext.Provider>
                                    </div>
                                </div>
                            </motion.div>
                        </TransitioningContent>
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
})
