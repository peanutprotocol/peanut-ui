import OnboardingAnimation from './OnboardingAnimation'
import { SetupLanguageSwitcher } from './SetupLanguageSwitcher'
import starImage from '@/assets/icons/star.png'
import { Button } from '@/components/0_Bruddle/Button'
import { CarouselDots } from '@/components/0_Bruddle/CarouselDots'
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

const SetupImageContext = createContext<(illustration: SetupIllustration | null) => void>(() => {})

/**
 * Lets a step's sub-view swap the wrapper's illustration for as long as it is
 * mounted. Sub-views are not steps, so they have no step config of their own
 * to carry an image.
 */
export const useSetupImageOverride = (illustration: SetupIllustration | null) => {
    const setImage = useContext(SetupImageContext)
    useLayoutEffect(() => {
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
    /** Isolated Screen Library presentation; never reads or writes install state. */
    firstLaunchIntroPreview?: 'play' | 'still'
    fullScreen?: boolean
    showProgress?: boolean
}

// define responsive height classes for different layout types
const IMAGE_CONTAINER_CLASSES: Record<LayoutType, string> = {
    signup: 'h-[40dvh] shrink-0 md:h-dvh',
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

const SETUP_KEYBOARD_FOCUS_KEYS = new Set([
    'Tab',
    'Enter',
    ' ',
    'ArrowUp',
    'ArrowDown',
    'ArrowLeft',
    'ArrowRight',
    'Home',
    'End',
    'PageUp',
    'PageDown',
])

const isEditableFocusTarget = (target: EventTarget | null) =>
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLInputElement && !['button', 'checkbox', 'radio', 'submit'].includes(target.type)) ||
    (target instanceof HTMLElement && target.isContentEditable)

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
            inert={!isPresent}
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

function UsernameBackground() {
    return (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" data-username-background>
            <OnboardingAnimation name="username" background />
        </div>
    )
}

// Count the residence checklist as a screen, while keeping five stable groups
// across the two residence-dependent feature slots.
const SETUP_PROGRESS_SCREEN_INDEX: Partial<Record<ScreenId, number>> = {
    landing: 0,
    signup: 1,
    'advantage-fees': 2,
    'advantage-card': 6,
    residence: 3,
    'advantage-bank': 5,
    'advantage-exchange': 5,
    'advantage-local': 6,
    'advantage-people': 6,
    'funding-methods': 7,
    'passkey-permission': 8,
    'notification-email': 9,
    'notification-permission': 10,
    'advantage-control': 12,
    'sign-test-transaction': 12,
}

function SetupProgressHeader({
    step,
    totalSteps,
    screenId,
    hidden = false,
    compact = false,
}: {
    step?: number
    totalSteps?: number
    screenId: ScreenId
    hidden?: boolean
    compact?: boolean
}) {
    const t = useTranslations('setup.wrapper')
    const screenIndex =
        screenId === 'advantage-exchange' && step !== undefined
            ? step === 4
                ? 5
                : 6
            : (SETUP_PROGRESS_SCREEN_INDEX[screenId] ?? step ?? 0)
    const progressGroup = Math.min(4, Math.floor(screenIndex / 3))
    return (
        <div
            aria-hidden={hidden}
            inert={hidden}
            className={twMerge(
                hidden && 'invisible',
                'pointer-events-none z-20 flex h-11 w-full items-center gap-3 px-4 md:px-6',
                compact ? 'relative my-4 shrink-0' : 'absolute inset-x-0 top-4 md:top-8',
                screenId === 'sign-test-transaction' && 'pr-16 md:pr-16'
            )}
        >
            <div className="w-9 shrink-0" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 justify-center">
                {step !== undefined && totalSteps !== undefined && totalSteps > 0 && step >= 0 && step < totalSteps && (
                    <CarouselDots
                        count={5}
                        activeIndex={progressGroup}
                        className="pointer-events-none"
                        aria-label={t('stepIndicator', { current: progressGroup + 1, total: 5 })}
                    />
                )}
            </div>
            <SetupLanguageSwitcher />
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
    step,
    totalSteps,
    direction = 0,
    prefersReducedMotion,
    intro,
}: Pick<
    SetupWrapperProps,
    'layoutType' | 'image' | 'screenId' | 'imageClassName' | 'step' | 'totalSteps' | 'direction'
> & {
    prefersReducedMotion: boolean
    intro: ReturnType<typeof useFirstLaunchIntro>
}) => {
    const t = useTranslations('setup.wrapper')
    const introPresentation = intro.active || intro.played
    const [introLayout, setIntroLayout] = useState<{ viewport: number; available: number; mobile: boolean } | null>(
        null
    )
    useLayoutEffect(() => {
        if (!introPresentation) return
        const measure = () => {
            const styles = getComputedStyle(document.documentElement)
            const viewport = window.innerHeight
            const safeTop = parseFloat(styles.getPropertyValue('--safe-top')) || 0
            const safeBottom = parseFloat(styles.getPropertyValue('--safe-bottom')) || 0
            setIntroLayout({ viewport, available: viewport - safeTop - safeBottom, mobile: window.innerWidth < 768 })
        }
        measure()
        window.addEventListener('resize', measure)
        return () => window.removeEventListener('resize', measure)
    }, [introPresentation])
    const restingHeight = introLayout ? (introLayout.mobile ? introLayout.viewport * 0.4 : introLayout.viewport) : 0

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
                custom={direction}
                variants={mascotVariants}
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
                          : STEP_TRANSITION
                }
                className={twMerge(
                    'absolute inset-x-0 flex items-center justify-center',
                    intro.active && !intro.played && 'invisible top-[calc(50%_-_22dvh)] h-[44dvh]',
                    !introPresentation && 'top-16 bottom-2 md:top-20 md:bottom-8'
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
                {/* render animated star decorations */}
                {screenId === 'landing' &&
                    !intro.active &&
                    STAR_POSITIONS.map((positions, index) => (
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
                {/* Keep clouds on the landing screen so later illustrations stay clear. */}
                {screenId === 'landing' && !intro.active && <CloudsBackground minimal />}
                {screenId === 'signup' && <UsernameBackground />}
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
                <SetupProgressHeader step={step} totalSteps={totalSteps} screenId={screenId} hidden={intro.active} />
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
    firstLaunchIntroPreview,
    fullScreen: fullScreenProp = false,
    showProgress = true,
}: SetupWrapperProps) {
    const [imageOverride, setImageOverride] = useState<{ screenId: ScreenId; image: SetupIllustration } | null>(null)
    const setImageForScreen = useCallback(
        (illustration: SetupIllustration | null) =>
            setImageOverride(illustration ? { screenId, image: illustration } : null),
        [screenId]
    )
    const [fullScreenOverride, setFullScreenOverride] = useState<ScreenId | null>(null)
    const setFullScreenForScreen = useCallback(
        (enabled: boolean) => setFullScreenOverride(enabled ? screenId : null),
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
    useEffect(() => {
        // A tapped text field can still match :focus-visible in Chromium. Track
        // how focus was reached so pointer focus stays pink while keyboard
        // navigation keeps a high-contrast ring. Typing in a field does not
        // switch the focus style.
        const root = document.documentElement
        root.dataset.setupInputModality = 'keyboard'
        const onPointerDown = () => {
            root.dataset.setupInputModality = 'pointer'
        }
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.altKey || event.ctrlKey || !SETUP_KEYBOARD_FOCUS_KEYS.has(event.key)) return
            if ((event.key === 'Enter' || event.key === ' ') && isEditableFocusTarget(event.target)) return
            root.dataset.setupInputModality = 'keyboard'
        }
        document.addEventListener('pointerdown', onPointerDown, true)
        document.addEventListener('keydown', onKeyDown, true)
        return () => {
            document.removeEventListener('pointerdown', onPointerDown, true)
            document.removeEventListener('keydown', onKeyDown, true)
            delete root.dataset.setupInputModality
        }
    }, [])
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
            data-setup-flow="true"
            data-first-launch-intro={intro.active ? intro.phase : undefined}
            className={twMerge(
                'flex min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] flex-col overflow-x-hidden overflow-y-auto',
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
                onBack={onBack}
                onSkip={onSkip}
                onLogout={onLogout}
                isLoggingOut={isLoggingOut}
            />

            {/* content container */}
            {/* Keep the outgoing hero and content together until exit completes. */}
            <AnimatePresence initial={false} custom={transitionDirection} mode="wait">
                <TransitioningContent
                    key={screenId}
                    direction={transitionDirection}
                    prefersReducedMotion={!!prefersReducedMotion}
                    className={twMerge('mx-auto flex w-full flex-grow flex-col', !fullScreen && 'md:flex-row')}
                >
                    {/* illustration section */}
                    {fullScreen ? (
                        showProgress && (
                            <SetupProgressHeader step={step} totalSteps={totalSteps} screenId={screenId} compact />
                        )
                    ) : (
                        <ImageSection
                            imageClassName={imageClassName}
                            screenId={screenId}
                            layoutType={layoutType}
                            image={imageOverride?.screenId === screenId ? imageOverride.image : image}
                            step={step}
                            totalSteps={totalSteps}
                            direction={transitionDirection}
                            prefersReducedMotion={!!prefersReducedMotion}
                            intro={intro}
                        />
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
                            'flex flex-grow flex-col justify-between overflow-x-hidden overflow-y-auto bg-white px-6 pt-10 pb-6 md:h-dvh',

                            fullScreen && 'md:h-auto md:flex-1'
                        )}
                    >
                        <div
                            className={twMerge(
                                'flex w-full flex-1 flex-col justify-between md:flex-1',
                                contentClassName,
                                'gap-8',
                                screenId !== 'landing' && 'md:flex-1 md:justify-between',
                                fullScreen && 'flex-1 items-stretch md:flex-1 md:justify-between'
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
                                        screenId === 'landing' && 'space-y-2',
                                        (screenId === 'signup' || screenId == 'join-beta') && 'md:max-h-12',
                                        sunsetLanding && 'md:h-auto md:max-h-none'
                                    )}
                                >
                                    {title && (
                                        <h1
                                            className={twMerge(
                                                'w-full text-left text-heading-s',
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
                                                'text-body-m leading-[1.625rem] text-foreground-secondary',
                                                sunsetLanding && 'md:text-center'
                                            )}
                                        >
                                            {description}
                                        </p>
                                    )}
                                </div>
                            )}
                            {/* main content area */}
                            <div
                                className={twMerge(
                                    'mx-auto w-full',
                                    fullScreen ? 'flex flex-1 flex-col md:max-w-md' : 'md:max-w-xs',
                                    screenId !== 'landing' && 'flex flex-1 flex-col'
                                )}
                            >
                                <SetupFullScreenContext.Provider value={setFullScreenForScreen}>
                                    <SetupImageContext.Provider value={setImageForScreen}>
                                        {children}
                                    </SetupImageContext.Provider>
                                </SetupFullScreenContext.Provider>
                            </div>
                        </div>
                    </motion.div>
                </TransitioningContent>
            </AnimatePresence>
        </div>
    )
})
