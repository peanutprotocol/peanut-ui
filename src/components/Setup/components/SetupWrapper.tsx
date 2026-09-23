import starImage from '@/assets/icons/star.png'
import { Button } from '@/components/0_Bruddle/Button'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import PeanutMascot from '@/components/Global/PeanutMascot'
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
    direction?: number
}

// define responsive height classes for different layout types
const IMAGE_CONTAINER_CLASSES: Record<LayoutType, string> = {
    signup: 'h-[35dvh] shrink-0 md:h-dvh',
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
            className={className}
            aria-hidden={!isPresent}
            style={{ pointerEvents: isPresent ? 'auto' : 'none' }}
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
    direction = 0,
    prefersReducedMotion,
}: Pick<SetupWrapperProps, 'layoutType' | 'image' | 'screenId' | 'imageClassName' | 'direction'> & {
    prefersReducedMotion: boolean
}) => {
    const t = useTranslations('setup.wrapper')

    if (!image) return null

    const isSignup = layoutType === 'signup'
    const containerClass = IMAGE_CONTAINER_CLASSES[layoutType]
    const imageKey = 'pose' in image ? image.pose : image.src
    const illustration =
        'pose' in image ? (
            <PeanutMascot
                pose={image.pose}
                alt={t('illustrationAlt')}
                className={imageClassName || MASCOT_HERO_CLASS}
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
                    'relative flex w-full flex-row items-center justify-center overflow-hidden bg-background-setup-hero px-4 md:h-dvh md:w-7/12 md:px-6'
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
            </div>
        )
    }

    // standard layout rendering without decorations
    return (
        <div
            className={twMerge(
                containerClass,
                'relative flex w-full flex-row items-center justify-center overflow-hidden bg-background-setup-hero md:h-dvh md:w-7/12',
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
        <div className="flex min-h-[calc(100dvh_-_var(--safe-top)_-_var(--safe-bottom))] flex-col overflow-x-hidden overflow-y-auto">
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
