'use client'

import { Card } from '@/components/0_Bruddle'
import { Icon, IconName } from '@/components/Global/Icons/Icon'
import React from 'react'

interface BannerCardProps {
    icon: IconName
    title: string
    description: string
    onClose: () => void
}

const BannerCard = ({ title, description, icon, onClose }: BannerCardProps) => {
    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation()
        onClose()
    }

    return (
        <Card className="embla__slide relative flex flex-row items-center justify-around p-2">
            <div className="absolute right-2 top-2">
                <Icon onClick={handleClose} name="cancel" size={10} />
            </div>

            <div className="flex size-8  items-center justify-center rounded-full bg-primary-1">
                <Icon name={icon} size={20} />
            </div>
            <div className="flex w-[80%] flex-col">
                <p className="font-medium">{title}</p>
                <p className="text-xs text-gray-1">{description}</p>
            </div>
        </Card>
    )
}

export default BannerCard
