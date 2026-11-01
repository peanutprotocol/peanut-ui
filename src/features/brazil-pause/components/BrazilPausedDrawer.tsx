'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useTranslations } from 'next-intl'
import { useSyncExternalStore } from 'react'
import {
    closeBrazilPausedDrawer,
    isBrazilPausedDrawerOpen,
    subscribeBrazilPausedDrawer,
} from '../brazil-paused-drawer-store'

/**
 * Why a Brazil deposit, withdrawal or Pix payment does not start while the
 * Brazil pause is on. The app layout renders it once; a Brazil entry opens it
 * in place of its flow. Same layout as `ClosedRowDrawer`.
 */
export function BrazilPausedDrawer() {
    const t = useTranslations('brazilPause')
    const tCommon = useTranslations('common')
    const open = useSyncExternalStore(subscribeBrazilPausedDrawer, isBrazilPausedDrawerOpen, () => false)

    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && closeBrazilPausedDrawer()}>
            <DrawerContent className="pb-4" data-testid="brazil-paused-drawer">
                <div className="flex flex-col items-center text-center">
                    <IconBubble icon="clock" color="gray" className="mb-4" />
                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{t('title')}</DrawerTitle>
                        <DrawerDescription>{t('body')}</DrawerDescription>
                    </DrawerHeader>
                    <Button variant="primary" className="mt-6 w-full" onClick={closeBrazilPausedDrawer}>
                        {tCommon('gotIt')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
