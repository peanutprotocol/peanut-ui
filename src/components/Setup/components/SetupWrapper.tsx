import starImage from '@/assets/icons/star.png'
import { Button } from '@/components/0_Bruddle'
import CloudsBackground from '@/components/0_Bruddle/CloudsBackground'
import Icon from '@/components/Global/Icon'
import classNames from 'classnames'
import Image from 'next/image'
import { ReactNode, memo, Children, cloneElement, type ReactElement } from 'react'
import { twMerge } from 'tailwind-merge'
import { LayoutType, ScreenId, BeforeInstallPromptEvent } from '@/components/Setup/Setup.types'
import InstallPWA from '@/components/Setup/Views/InstallPWA'

/**
 * props interface for the SetupWrapper component
 * defines the structure and configuration options for the setup flow
 */
interface SetupWrapperProps {
    layoutType: LayoutType
    screenId: ScreenId
    children: ReactNode
    image?: string
    imageClassName?: string
    title?: string
    description?: string
    contentClassName?: string
    showBackButton?: boolean
    showSkipButton?: boolean
    onBack?: () => void
    onSkip?: () => void
    step?: number
    direction?: number
    deferredPrompt?: BeforeInstallPromptEvent | null
    canInstall?: boolean
}

// define responsive height classes for different layout types
const IMAGE_CONTAINER_CLASSES: Record<LayoutType, string> = {
    welcome: 'min-h-[45vh] md:min-h-full', // welcome view has smaller container height
    signup: 'min-h-[55vh] md:min-h-full', // signup view has larger container height
    standard: 'min-h-[50vh] md:min-h-full', // rest all views has medium container height
}

// define animated star decorations positions and sizes
// each array element represents a star with specific positioning and animation
const STAR_POSITIONS = [
    'left-[10%] md:left-[15%] lg:left-[15%] animate-rock-delay-1 top-[15%] md:top-[20%]  size-13 md:size-14',
    'right-[10%] md:right-[15%] lg:right-[15%] animate-rock top-[10%] md:top-[20%] size-10 md:size-14',
    'left-[10%] md:left-[15%] lg:left-[15%] animate-rock-delay-2 bottom-[15%] md:bottom-[20%] size-12 md:size-14',
    'right-[10%] md:right-[15%] lg:right-[15%] animate-rock-delay-2 bottom-[30%] size-6 md:size-14',
] as const

/**
 * navigation component for back and skip buttons
 * rendered at the top of the layout when either button is enabled
 */
const Navigation = memo(
    ({
        showBackButton,
        showSkipButton,
        onBack,
        onSkip,
    }: Pick<SetupWrapperProps, 'showBackButton' | 'showSkipButton' | 'onBack' | 'onSkip'>) => {
        if (!showBackButton && !showSkipButton) return null

        return (
            <div className="absolute top-8 z-20 flex w-full items-center justify-between px-6">
                {showBackButton && (
                    <Button variant="stroke" onClick={onBack} className="h-8 w-8 p-0" aria-label="Go back">
                        <Icon name="arrow-prev" className="h-7 w-7" />
                    </Button>
                )}
                {showSkipButton && (
                    <Button onClick={onSkip} variant="transparent-dark" className="h-auto w-fit p-0">
                        <span className="text-grey-1">Skip</span>
                    </Button>
                )}
            </div>
        )
    }
)

/**
 * ImageSection component handles the illustrations and animations
 * renders differently based on layout type with optional animated decorations
 */
const ImageSection = ({
    layoutType,
    image,
    screenId,
    imageClassName,
}: Pick<SetupWrapperProps, 'layoutType' | 'image' | 'screenId' | 'imageClassName'>) => {
    if (!image) return null

    const isWelcomeOrSignup = layoutType === 'welcome' || layoutType === 'signup'
    const containerClass = IMAGE_CONTAINER_CLASSES[layoutType]
    const imageClass = !!imageClassName
        ? imageClassName
        : 'w-full max-w-[80%] md:max-w-[75%] lg:max-w-xl object-contain relative'

    // special rendering for welcome/signup screens with animated decorations
    if (isWelcomeOrSignup) {
        return (
            <div
                className={twMerge(
                    containerClass,
                    'relative flex w-full flex-row items-center justify-center overflow-hidden bg-secondary-3/100 px-4 md:h-[100dvh] md:w-7/12 md:px-6'
                )}
            >
                {/* render animated star decorations */}
                {STAR_POSITIONS.map((positions, index) => (
                    <Image
                        key={index}
                        src={starImage.src}
                        alt="star"
                        width={56}
                        height={56}
                        className={twMerge(positions, 'absolute z-10')}
                        priority={index === 0}
                    />
                ))}
                {/* animated clouds background */}
                <CloudsBackground minimal />
                {/* main illustration image */}
                <Image
                    src={image}
                    alt="Section illustration"
                    width={500}
                    height={500}
                    className={imageClass}
                    priority
                />
            </div>
        )
    }

    // standard layout rendering without decorations
    return (
        <div
            className={classNames(
                containerClass,
                'flex w-full flex-row items-center justify-center bg-secondary-3/100 md:h-[100dvh] md:w-7/12',
                screenId === 'success' && 'bg-secondary-1/15'
            )}
        >
            <Image
                src={image}
                alt="Section illustration"
                width={500}
                height={500}
                className={twMerge(imageClass)}
                priority
            />
        </div>
    )
}

/**
 * main SetupWrapper component
 * provides a responsive layout structure for setup/onboarding screens
 * uses dynamic viewport height (dvh) for better mobile browser compatibility
 */
export const SetupWrapper = memo(
    ({
        layoutType,
        children,
        image,
        title,
        description,
        contentClassName,
        showBackButton,
        showSkipButton,
        onBack,
        onSkip,
        screenId,
        imageClassName,
        deferredPrompt,
        canInstall,
    }: SetupWrapperProps) => {
        return (
            <div className="flex min-h-[100dvh] flex-col">
                {/* navigation buttons */}
                <Navigation
                    showBackButton={showBackButton}
                    showSkipButton={showSkipButton}
                    onBack={onBack}
                    onSkip={onSkip}
                />

                {/* content container */}
                <div className="mx-auto flex w-full flex-grow flex-col md:flex-row">
                    {/* illustration section */}
                    <ImageSection
                        imageClassName={imageClassName}
                        screenId={screenId}
                        layoutType={layoutType}
                        image={image}
                    />

                    {/* content section */}
                    <div
                        className={twMerge(
                            'flex flex-grow flex-col justify-between overflow-hidden bg-white px-6 pb-8 pt-6 md:h-[100dvh] md:justify-center md:space-y-4',
                            contentClassName
                        )}
                    >
                        {/* todo: add transition animation */}
                        {/* title and description container */}
                        <div
                            className={twMerge(
                                'mx-auto h-full w-full space-y-4 md:max-h-48 md:max-w-xs',
                                screenId === 'signup' && 'md:max-h-12'
                            )}
                        >
                            {title && (
                                <h1 className="w-full text-left text-3xl font-extrabold leading-tight">{title}</h1>
                            )}
                            {description && <p className="text-base">{description}</p>}
                        </div>
                        {/* main content area */}
                        <div className="mx-auto w-full md:max-w-xs">
                            {Children.map(children, (child) => {
                                if ((child as ReactElement).type === InstallPWA) {
                                    return cloneElement(child as ReactElement, { deferredPrompt, canInstall })
                                }
                                return child
                            })}
                        </div>
                    </div>
                </div>
            </div>
        )
    }
)
