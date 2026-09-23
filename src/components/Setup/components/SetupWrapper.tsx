import starImage from '@/assets/icons/star.png'
import { Button } from '@/components/0_Bruddle/Button'
import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import PeanutMascot from '@/components/Global/PeanutMascot'
import { PeanutMascotScene } from '@/components/Global/PeanutMascot/PeanutMascotScene'
import { MASCOT_HERO_CLASS } from '@/components/Global/PeanutMascot/PeanutMascot.consts'
import { type LayoutType, type ScreenId, type SetupIllustration } from '@/components/Setup/Setup.types'
import { useKeepWebBypass } from '@/hooks/useKeepWebBypass'
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

const SetupImageContext = createContext<(illustration: SetupIllustration | null) => void>(() => {})

/**
 * Lets a step's sub-view swap the wrapper's illustration for as long as it is
 * mounted — the residence step's "Good news" outcome celebrates, while the
 * selector it shares a step with keeps the neutral greeting. Sub-views are not
 * steps, so they have no step config of their own to carry an image.
 */
export const useSetupImageOverride = (illustration: SetupIllustration | null) => {
    const setImage = useContext(SetupImageContext)
    useEffect(() => {
        setImage(illustration)
        return () => setImage(null)
    }, [illustration, setImage])
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
    title?: string
    description?: string
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
    totalSteps?: number
    direction?: number
}

// define responsive height classes for different layout types
const IMAGE_CONTAINER_CLASSES: Record<LayoutType, string> = {
    signup: 'h-[47dvh] shrink-0 md:h-dvh',
}

const setupHeroProgress = (step: number | undefined, totalSteps: number | undefined, screenId: ScreenId) => {
    // Use the filtered journey length: skipped steps should not leave the last
    // screen short of pink. The standalone /setup/finish route has no cursor.
    return step !== undefined && totalSteps !== undefined && totalSteps > 1
        ? Math.max(0, Math.min(1, step / (totalSteps - 1)))
        : screenId === 'sign-test-transaction'
          ? 1
          : 0
}

const setupHeroBackground = (progress: number) => {
    const bluePercent = Math.round((1 - progress) * 100)
    return `color-mix(in oklab, var(--color-background-setup-hero) ${bluePercent}%, var(--color-action-primary))`
}

/** The older Android OS status bar needs a hex value rather than a CSS color. */
const setupHeroNativeHex = (progress: number): string | null => {
    const styles = getComputedStyle(document.documentElement)
    const blue = styles.getPropertyValue('--color-background-setup-hero').trim()
    const pink = styles.getPropertyValue('--color-action-primary').trim()
    if (!/^#[\da-f]{6}$/i.test(blue) || !/^#[\da-f]{6}$/i.test(pink)) return null
    const channels = [1, 3, 5].map((index) => {
        const start = Number.parseInt(blue.slice(index, index + 2), 16)
        const end = Number.parseInt(pink.slice(index, index + 2), 16)
        return Math.round(start + (end - start) * progress)
            .toString(16)
            .padStart(2, '0')
    })
    return `#${channels.join('')}`
}

const stepVariants = {
    enter: (direction: number) => ({ x: direction < 0 ? -48 : 48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? 48 : -48, opacity: 0 }),
}

const mascotVariants = {
    enter: (direction: number) => ({ x: direction < 0 ? '-100%' : '100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction < 0 ? '100%' : '-100%', opacity: 0 }),
}

const STEP_TRANSITION = { duration: 0.3, ease: [0.22, 1, 0.36, 1] } as const

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
    return (
        <motion.div
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={prefersReducedMotion ? { duration: 0 } : STEP_TRANSITION}
            className={twMerge(className, !isPresent && 'pointer-events-none')}
            aria-hidden={!isPresent}
        >
            {children}
        </motion.div>
    )
}

// define animated star decorations positions and sizes
// each array element represents a star with specific positioning and animation
const STAR_POSITIONS = [
    'left-[10%] md:left-[15%] lg:left-[15%] top-[15%] md:top-[20%]  size-13 md:size-14',
    // mobile top-[24%], not [10%]: the nav row (Iniciar sesión / skip) owns the
    // top band and the star sat right under the text (TASK-22366 nit)
    'right-[10%] md:right-[15%] lg:right-[15%] top-[24%] md:top-[20%] size-10 md:size-14',
    'left-[10%] md:left-[15%] lg:left-[15%] bottom-[15%] md:bottom-[20%] size-12 md:size-14',
    'right-[10%] md:right-[15%] lg:right-[15%] bottom-[30%] size-6 md:size-14',
] as const

/**
 * navigation component for back, skip and logout buttons
 * rendered at the top of the layout when any button is enabled
 */
const Navigation = memo(function Navigation({
    showBackButton,
    showSkipButton,
    showLogoutButton,
    onBack,
    onSkip,
    onLogout,
    isLoggingOut,
}: Pick<
    SetupWrapperProps,
    'showBackButton' | 'showSkipButton' | 'showLogoutButton' | 'onBack' | 'onSkip' | 'onLogout' | 'isLoggingOut'
>) {
    const t = useTranslations('setup.navigation')

    if (!showBackButton && !showSkipButton && !showLogoutButton) return null

    // Icons inherit currentColor: the circle fills on hover/active, and a
    // hard-coded fill vanished into the fill colour.
    // The row's containing block is the initial one (no positioned ancestor).
    // Match app navigation at 16px from either horizontal edge and 16px below
    // the safe-area boundary; on web --safe-top is zero.
    return (
        <div className="absolute top-[calc(var(--safe-top)_+_1rem)] z-20 flex w-full items-center justify-between px-4">
            <div>
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
            </div>
        </div>
    )
})

/**
 * ImageSection component handles the illustrations and animations
 * renders differently based on layout type with optional animated decorations
 */
const ImageSection = ({
    layoutType,
    image,
    screenId,
    imageClassName,
    step,
    totalSteps,
    direction = 0,
    prefersReducedMotion,
}: Pick<
    SetupWrapperProps,
    'layoutType' | 'image' | 'screenId' | 'imageClassName' | 'step' | 'totalSteps' | 'direction'
> & {
    prefersReducedMotion: boolean
}) => {
    const t = useTranslations('setup.wrapper')

    if (!image) return null

    const isSignup = layoutType === 'signup'
    const containerClass = IMAGE_CONTAINER_CLASSES[layoutType]
    const imageKey = 'pose' in image ? image.pose : 'scene' in image ? image.scene : image.src
    const illustration =
        'pose' in image ? (
            <PeanutMascot
                pose={image.pose}
                alt={t('illustrationAlt')}
                className={twMerge(
                    imageClassName || MASCOT_HERO_CLASS,
                    // The wide landing pose reads much larger horizontally. Scale
                    // only this first appearance down by 20%.
                    screenId === 'landing' && 'scale-[0.8]'
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
                custom={direction}
                variants={mascotVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={prefersReducedMotion ? { duration: 0 } : STEP_TRANSITION}
                className="absolute inset-0 flex items-center justify-center"
            >
                {illustration}
            </motion.div>
        </AnimatePresence>
    )

    // special rendering for welcome/signup screens with animated decorations
    if (isSignup) {
        return (
            <div
                className={twMerge(
                    containerClass,
                    'setup-hero-background relative flex w-full flex-row items-center justify-center overflow-hidden px-4 transition-colors duration-fast ease-in-out motion-reduce:transition-none md:h-dvh md:w-7/12 md:px-6'
                )}
            >
                {/* render animated star decorations */}
                {STAR_POSITIONS.map((positions, index) => (
                    <Image
                        key={index}
                        src={starImage.src}
                        alt={t('starAlt')}
                        width={56}
                        height={56}
                        className={twMerge(positions, 'absolute z-10')}
                        priority={index === 0}
                    />
                ))}
                {/* animated clouds background */}
                <CloudsBackground minimal />
                {animatedIllustration}
                {step !== undefined && totalSteps !== undefined && totalSteps > 0 && step >= 0 && step < totalSteps && (
                    <CarouselDots
                        count={totalSteps}
                        activeIndex={step}
                        variant="white"
                        className="pointer-events-none absolute top-8 left-1/2 z-20 -translate-x-1/2"
                        aria-label={t('stepIndicator', { current: step + 1, total: totalSteps })}
                    />
                )}
            </div>
        )
    }

    // standard layout rendering without decorations
    return (
        <div
            className={twMerge(
                containerClass,
                'relative flex w-full flex-row items-center justify-center overflow-hidden transition-colors duration-fast ease-in-out motion-reduce:transition-none md:h-dvh md:w-7/12',
                screenId !== 'success' && 'setup-hero-background',
                screenId === 'success' && 'bg-action-secondary/15'
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
    totalSteps,
    direction = 0,
}: SetupWrapperProps) {
    const [imageOverride, setImageOverride] = useState<{ screenId: ScreenId; image: SetupIllustration } | null>(null)
    const setImageForScreen = useCallback(
        (illustration: SetupIllustration | null) =>
            setImageOverride(illustration ? { screenId, image: illustration } : null),
        [screenId]
    )
    const prefersReducedMotion = useReducedMotion()
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
    const heroProgress = setupHeroProgress(step, totalSteps, screenId)
    const heroBackground = setupHeroBackground(heroProgress)
    useLayoutEffect(() => {
        // The hero, banner, and safe-area strips share one value so no blue seam
        // remains above a later pink step. Layout effect applies it before paint.
        document.documentElement.style.setProperty('--setup-hero-background', heroBackground)
        return () => {
            document.documentElement.style.removeProperty('--setup-hero-background')
        }
    }, [heroBackground])
    useEffect(() => {
        if (!isCapacitor()) return
        let cancelled = false
        // Let the native status bar reach the same destination as the CSS tint.
        // A pending older step is cancelled when navigation changes rapidly.
        const durationToken = getComputedStyle(document.documentElement)
            .getPropertyValue('--transition-duration-fast')
            .trim()
        let duration = 200
        if (durationToken.endsWith('ms')) duration = Number.parseFloat(durationToken)
        else if (durationToken.endsWith('s')) duration = Number.parseFloat(durationToken) * 1000
        if (prefersReducedMotion) duration = 0
        const timeout = window.setTimeout(() => {
            const color = setupHeroNativeHex(heroProgress)
            if (!color) return
            void import('@capacitor/status-bar')
                .then(async ({ StatusBar }) => {
                    if (!cancelled) await StatusBar.setBackgroundColor({ color })
                })
                .catch(() => {})
        }, duration)
        return () => {
            cancelled = true
            window.clearTimeout(timeout)
        }
    }, [heroProgress, prefersReducedMotion])
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
    const animatePanelIn = slideUpPanel && !prefersReducedMotion

    return (
        <div
            className={twMerge(
                'flex min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] flex-col overflow-x-hidden overflow-y-auto',
                // The first panel rises from below the viewport. Fill the exposed
                // space with the same blue as the hero, not the page beige.
                screenId === 'landing' && 'bg-background-setup-hero'
            )}
        >
            {/* navigation buttons */}
            <Navigation
                showBackButton={showBackButton}
                showSkipButton={showSkipButton}
                showLogoutButton={showLogoutButton}
                onBack={onBack}
                onSkip={onSkip}
                onLogout={onLogout}
                isLoggingOut={isLoggingOut}
            />

            {/* content container */}
            <div className="mx-auto flex w-full flex-grow flex-col md:flex-row">
                {/* illustration section */}
                <ImageSection
                    imageClassName={imageClassName}
                    screenId={screenId}
                    layoutType={layoutType}
                    image={imageOverride?.screenId === screenId ? imageOverride.image : image}
                    step={step}
                    totalSteps={totalSteps}
                    direction={transitionDirection}
                    prefersReducedMotion={!!prefersReducedMotion}
                />

                {/* content section */}
                <motion.div
                    initial={animatePanelIn ? { y: '100%' } : false}
                    animate={animatePanelIn ? { y: 0 } : undefined}
                    transition={{ type: 'spring', stiffness: 260, damping: 30 }}
                    className="flex flex-grow flex-col justify-between overflow-x-hidden overflow-y-auto bg-white px-6 pt-6 pb-8 md:h-dvh md:justify-center"
                >
                    <AnimatePresence initial={false} custom={transitionDirection} mode="wait">
                        <TransitioningContent
                            key={screenId}
                            direction={transitionDirection}
                            prefersReducedMotion={!!prefersReducedMotion}
                            className={twMerge(
                                'flex w-full flex-1 flex-col justify-between md:flex-none',
                                contentClassName
                            )}
                        >
                            {/* title and description container. Skipped entirely when
                        the step renders its own heading (titleInView +
                        descriptionInView): the wrapper is height-capped on
                        desktop, so an empty slot would push the content down
                        by up to 12rem. */}
                            {(title || description) && (
                                <div
                                    className={twMerge(
                                        'mx-auto space-y-4 w-full md:max-h-48 md:max-w-xs',
                                        (screenId === 'signup' || screenId == 'join-beta') && 'md:max-h-12',
                                        sunsetLanding && 'md:h-auto md:max-h-none'
                                    )}
                                >
                                    {title && (
                                        <h1
                                            className={twMerge(
                                                'w-full text-left text-heading-xs leading-tight',
                                                sunsetLanding && 'md:text-center',
                                                titleClassName
                                            )}
                                        >
                                            {title}
                                        </h1>
                                    )}
                                    {description && (
                                        <p
                                            className={twMerge(
                                                'text-body-m text-foreground-primary',
                                                sunsetLanding && 'md:text-center'
                                            )}
                                        >
                                            {description}
                                        </p>
                                    )}
                                </div>
                            )}
                            {/* main content area */}
                            <div className="mx-auto w-full md:max-w-xs">
                                <SetupImageContext.Provider value={setImageForScreen}>
                                    {children}
                                </SetupImageContext.Provider>
                            </div>
                        </TransitioningContent>
                    </AnimatePresence>
                </motion.div>
            </div>
        </div>
    )
})
