'use client'

import { Card } from '@/components/0_Bruddle'
import { Icon, type IconName } from '@/components/Global/Icons/Icon'
import type { StaticImageData } from 'next/image'
import Image from 'next/image'
import React from 'react'
import { twMerge } from 'tailwind-merge'

interface BannerCardProps {
    icon: IconName
    title: string | React.ReactNode
    description: string | React.ReactNode
    logo?: StaticImageData
    onClose: () => void
    onClick?: () => void
    iconContainerClassName?: string
}

const BannerCard = ({ title, description, icon, onClose, onClick, logo, iconContainerClassName }: BannerCardProps) => {
    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation()
        onClose()
    }

    return (
        <Card onClick={onClick} className="embla__slide relative flex flex-row items-center justify-around p-2">
            <div className="absolute right-2 top-2">
                <Icon onClick={handleClose} name="cancel" size={10} />
            </div>

            <div
                className={twMerge(
                    'flex size-8  items-center justify-center rounded-full',
                    logo ? 'bg-transparent' : 'bg-primary-1',
                    iconContainerClassName
                )}
            >
                {/* Show icon only if logo isnt provided. Logo takes precedence over icon. */}
                {!logo && <Icon name={icon} size={20} />}
                {logo && <Image src={logo} alt={typeof title === 'string' ? title : 'logo'} width={32} height={32} />}
            </div>
            <div className="flex w-[80%] flex-col">
                <p className="font-medium">{title}</p>
                <p className="text-xs text-gray-1">{description}</p>
            </div>
        </Card>
    )
}

export default BannerCard
