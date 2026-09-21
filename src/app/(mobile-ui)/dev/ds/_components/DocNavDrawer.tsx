'use client'

import { useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { DocNavList } from './DocNavList'

/**
 * Mobile nav: the DS Drawer (vaul) already gives the dialog role, the focus
 * trap, Escape, the scroll lock and hardware back — a hand-rolled overlay gives
 * none of them. Holds the full nav, not just the current tier.
 */
export function DocNavDrawer() {
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <Button variant="stroke" size="small" icon="menu" className="w-auto" onClick={() => setIsOpen(true)}>
                Menu
            </Button>

            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                {/* the sheet fills the screen below the drag handle: the nav is
                    long and its own scroll is what makes it usable at 375x667 */}
                <DrawerContent className="md:hidden" scrollAreaClassName="max-h-[85vh]">
                    <DrawerHeader className="flex-row items-center justify-between text-left">
                        <DrawerTitle>Design System</DrawerTitle>
                        <DrawerClose asChild>
                            <Button
                                variant="transparent"
                                shape="square"
                                size="small"
                                icon="cancel"
                                aria-label="Close menu"
                            />
                        </DrawerClose>
                    </DrawerHeader>
                    <nav aria-label="Design system" className="pb-6">
                        <DocNavList onNavigate={() => setIsOpen(false)} />
                    </nav>
                </DrawerContent>
            </Drawer>
        </>
    )
}
