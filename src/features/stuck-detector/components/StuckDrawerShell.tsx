'use client'

import type { ReactNode } from 'react'
import { IconBubble, type IconBubbleColor } from '@/components/0_Bruddle/IconBubble'
import type { IconName } from '@/components/Global/Icons/Icon'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'

interface StuckDrawerShellProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    icon: IconName
    iconColor: IconBubbleColor
    title: string
    description?: string
    testId: string
    children: ReactNode
}

/**
 * Shared Bruddle Drawer anatomy for all proactive stuck-detection drawers:
 * drag-handle dismiss (no close X), semantic IconBubble, centred header, and `data-stuck-ignore`.
 */
export function StuckDrawerShell({
    open,
    onOpenChange,
    icon,
    iconColor,
    title,
    description,
    testId,
    children,
}: StuckDrawerShellProps) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent data-stuck-ignore="true">
                <div className="flex flex-col items-center pt-1 pb-6 text-center" data-testid={testId}>
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon={icon} color={iconColor} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{title}</DrawerTitle>
                            {description && <DrawerDescription>{description}</DrawerDescription>}
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col gap-4 text-left">{children}</div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
