'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { useModalsContext } from '@/context/ModalsContext'
import { twMerge } from '@/utils/tw'
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
            className={twMerge(
                'mx-auto h-20 w-20 cursor-pointer justify-center rounded-full p-4.5 hover:bg-action-primary/100',
                className
            )}
            disabled={disabled}
            icon={icon}
            iconSize={32}
            iconContainerClassName="size-8"
        />
    )
}
