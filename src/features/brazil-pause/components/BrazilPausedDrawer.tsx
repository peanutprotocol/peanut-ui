'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { useTranslations } from 'next-intl'
import { useRef, useSyncExternalStore } from 'react'
import {
    brazilPausedDrawerBlock,
    closeBrazilPausedDrawer,
    subscribeBrazilPausedDrawer,
} from '../brazil-paused-drawer-store'
import { usePixPayBlockCopy } from '../usePixPayBlockCopy'

/**
 * Why a Pix payment or a Pix-key send does not start: the Brazil pause, or a
 * residence the pay route does not serve. The app layout renders it once; an
 * entry opens it in place of its flow. Same layout as `ClosedRowDrawer`.
 */
export function BrazilPausedDrawer() {
    const tCommon = useTranslations('common')
    const block = useSyncExternalStore(subscribeBrazilPausedDrawer, brazilPausedDrawerBlock, () => null)
    const open = block !== null
    // a closing drawer keeps the words it opened with until it is gone
    const shown = useRef(block)
    if (block) shown.current = block
    const copy = usePixPayBlockCopy(shown.current ?? 'paused')

    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && closeBrazilPausedDrawer()}>
            <DrawerContent className="pb-4" data-testid="brazil-paused-drawer">
                <div className="flex flex-col items-center text-center">
                    <IconBubble
                        icon={shown.current === 'residence' ? 'alert' : 'clock'}
                        color="gray"
                        className="mb-4"
                    />
                    <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{copy.title}</DrawerTitle>
                        <DrawerDescription>{copy.body}</DrawerDescription>
                        {copy.keySend && <p className="text-body-s text-foreground-secondary">{copy.keySend}</p>}
                    </DrawerHeader>
                    <Button variant="primary" className="mt-6 w-full" onClick={closeBrazilPausedDrawer}>
                        {tCommon('gotIt')}
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
