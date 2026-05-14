'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import { twMerge } from 'tailwind-merge'
import { type IconName } from '../Icons/Icon'

export default function DirectSendQr({
    icon = 'qr-code',
    className = '',
    disabled = false,
}: {
    className?: string
    icon?: IconName
    disabled?: boolean
}) {
    const { setIsQRScannerOpen } = useModalsContext()

    return (
        <Button
            onClick={() => setIsQRScannerOpen(true)}
            variant="purple"
            shadowSize="4"
            shadowType="primary"
            className={twMerge(
                'mx-auto h-20 w-20 cursor-pointer justify-center rounded-full p-4.5 hover:bg-primary-1/100 active:translate-x-0 active:translate-y-0 active:scale-95',
                className
            )}
            disabled={disabled}
            icon={icon}
            iconSize={32}
            iconContainerClassName="!size-8"
        />
    )
}
