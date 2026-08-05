'use client'

import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import type { StaticImageData } from 'next/image'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import React from 'react'
import { twMerge } from 'tailwind-merge'
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
    secondaryIcon?: StaticImageData | string
    iconSize?: number
    // Perk claim indicator - shows pink dot instead of X close button
    isPerkClaim?: boolean
}

const CarouselCTA = ({
    title,
    description,
    icon,
    onClose,
    onClick,
    logo,
    iconContainerClassName,
    secondaryIcon,
    iconSize = 22,
    logoSize = 36,
    isPerkClaim,
}: CarouselCTAProps) => {
    const t = useTranslations('home.carousel')
    const { triggerHaptic } = useHaptic()

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation()
        onClose()
    }

    const handleClick = async () => {
        try {
            triggerHaptic()
            if (onClick) {
                await onClick()
            }
        } catch (error) {
            console.error('Error handling CTA click:', error)
        }
    }

    // Get descriptive title for accessibility
    const getAriaLabel = () => {
        if (typeof title === 'string') {
            return t('closeTitled', { title })
        }
        // For React nodes (e.g., "Unlock QR code payments"), use icon as hint
        if (icon === 'shield') {
            return t('closeVerificationPrompt')
        }
        if (icon === 'bell') {
            return t('closeNotificationPrompt')
        }
        return t('closePrompt')
    }

    return (
        <Card
            onClick={handleClick}
            className="embla__slide relative flex flex-row items-center justify-around px-2 py-2 md:py-3"
        >
            {/* Close button or pink dot indicator for perk claims */}
            {isPerkClaim ? (
                <div className={twMerge(CAROUSEL_CLOSE_BUTTON_POSITION, 'z-10')} aria-label={t('claimablePerk')}>
                    <div className="h-2.5 w-2.5 rounded-full bg-primary-1" />
                </div>
            ) : (
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
            )}

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
    )
}

export default CarouselCTA
