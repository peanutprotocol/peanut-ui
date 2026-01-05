'use client'

import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import type { StaticImageData } from 'next/image'
import Image from 'next/image'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import ActionModal from '@/components/Global/ActionModal'
import { CAROUSEL_CLOSE_BUTTON_POSITION, CAROUSEL_CLOSE_ICON_SIZE } from '@/constants/carousel.consts'
import { useHaptic } from 'use-haptic'
import { Card } from '@/components/0_Bruddle/Card'

interface CarouselCTAProps {
    icon: IconName
    title: string | React.ReactNode
    description: string | React.ReactNode
    logo?: StaticImageData
    logoSize?: number
    onClose: () => void
    onClick?: () => void | Promise<void>
    iconContainerClassName?: string
    // Notification-specific props
    isPermissionDenied?: boolean
    secondaryIcon?: StaticImageData | string
    iconSize?: number
}

const CarouselCTA = ({
    title,
    description,
    icon,
    onClose,
    onClick,
    logo,
    iconContainerClassName,
    isPermissionDenied,
    secondaryIcon,
    iconSize = 22,
    logoSize = 36,
}: CarouselCTAProps) => {
    const [showPermissionDeniedModal, setShowPermissionDeniedModal] = useState(false)
    const { triggerHaptic } = useHaptic()

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation()
        onClose()
    }

    const handleClick = async () => {
        try {
            triggerHaptic()
            if (isPermissionDenied) {
                setShowPermissionDeniedModal(true)
            } else if (onClick) {
                await onClick()
            }
        } catch (error) {
            console.error('Error handling CTA click:', error)
        }
    }

    // Get descriptive title for accessibility
    const getAriaLabel = () => {
        if (typeof title === 'string') {
            return `Close ${title}`
        }
        // For React nodes (e.g., "Unlock QR code payments"), use icon as hint
        if (icon === 'shield') {
            return 'Close verification prompt'
        }
        if (icon === 'bell' || isPermissionDenied) {
            return 'Close notification prompt'
        }
        return 'Close prompt'
    }

    return (
        <>
            <Card
                onClick={handleClick}
                className="embla__slide relative flex flex-row items-center justify-around px-2 py-2 md:py-3"
            >
                {/* Close button - consistent positioning and size */}
                <button
                    type="button"
                    aria-label={getAriaLabel()}
                    onClick={handleClose}
                    className={twMerge(
                        CAROUSEL_CLOSE_BUTTON_POSITION,
                        'z-10 cursor-pointer p-0 text-black outline-none'
                    )}
                >
                    <Icon name="cancel" size={CAROUSEL_CLOSE_ICON_SIZE} />
                </button>

                {/* Icon container */}
                <div
                    className={twMerge(
                        'relative flex size-8 items-center justify-center rounded-full',
                        logo ? 'bg-transparent' : 'bg-primary-1',
                        iconContainerClassName
                    )}
                >
                    {/* Show icon only if logo isn't provided. Logo takes precedence over icon. */}
                    {!logo && <Icon name={icon} size={iconSize} />}
                    {logo && (
                        <Image
                            src={logo}
                            alt={typeof title === 'string' ? title : 'logo'}
                            width={logoSize}
                            height={logoSize}
                        />
                    )}
                    {secondaryIcon && (
                        <Image
                            src={secondaryIcon}
                            alt="secondary icon"
                            height={64}
                            width={64}
                            quality={100}
                            className="absolute -right-1 bottom-0 z-50 size-4 rounded-full object-cover"
                        />
                    )}
                </div>

                {/* Content */}
                <div className="flex w-[80%] flex-col">
                    <p className="font-medium">{title}</p>
                    <p className="text-xs text-gray-1">{description}</p>
                </div>
            </Card>

            {/* Permission denied modal for notification CTA */}
            {isPermissionDenied && showPermissionDeniedModal && (
                <ActionModal
                    visible={showPermissionDeniedModal}
                    title="Turn notifications back on"
                    description={
                        <p>
                            <span>To keep getting updates, you'll need to reinstall the app on your home screen. </span>
                            <br />
                            <span>Don't worry, your account and data are safe. It only takes a minute.</span>
                        </p>
                    }
                    icon="bell"
                    onClose={() => {
                        setShowPermissionDeniedModal(false)
                    }}
                    ctaClassName="md:flex-col gap-4"
                    ctas={[
                        {
                            text: 'Got it!',
                            onClick: () => {
                                setShowPermissionDeniedModal(false)
                            },
                            shadowSize: '4',
                            variant: 'purple',
                        },
                        {
                            text: 'Reinstall later',
                            onClick: () => {
                                setShowPermissionDeniedModal(false)
                            },
                            variant: 'transparent',
                            className: 'underline h-6',
                        },
                    ]}
                />
            )}
        </>
    )
}

export default CarouselCTA
