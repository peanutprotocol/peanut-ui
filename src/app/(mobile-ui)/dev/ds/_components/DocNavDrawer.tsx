'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { twMerge } from '@/utils/tw'
import { DocNavList } from './DocNavList'

/**
 * Mobile nav: the DS Drawer (vaul) already gives the dialog role, the focus
 * trap, Escape, the scroll lock and hardware back — a hand-rolled overlay gives
 * none of them. Holds the full nav, not just the current tier.
 */
export function DocNavDrawer() {
    const [isOpen, setIsOpen] = useState(false)

    // the sheet is mobile-only, so md:hidden below stops it painting past 768px
    // (tailwind md) — but vaul keeps the overlay, the focus trap and the scroll
    // lock on an open drawer, so a resize while it is open leaves the desktop
    // page behind a black overlay it cannot dismiss. Close it on the crossing.
    useEffect(() => {
        const desktop = window.matchMedia('(min-width: 768px)')
        const closeOnDesktop = () => desktop.matches && setIsOpen(false)
        closeOnDesktop()
        desktop.addEventListener('change', closeOnDesktop)
        return () => desktop.removeEventListener('change', closeOnDesktop)
    }, [])

    return (
        <>
            {/* lives in NavHeader's trailing slot, which is a 2.5rem column:
                the nav circle button, like Profile's edit action. Desktop has
                the pinned sidebar, so the trigger is mobile-only. */}
            <Button
                variant="ghost"
                icon="menu"
                aria-label="Open menu"
                className={twMerge(NAV_CIRCLE_BUTTON_CLASSES, 'md:hidden')}
                onClick={() => setIsOpen(true)}
            />

            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                {/* the sheet fills the screen below the drag handle: the nav is
                    long and its own scroll is what makes it usable at 375x667 */}
                <DrawerContent className="md:hidden" scrollAreaClassName="max-h-[85vh]">
                    {/* `flex` is load-bearing: DrawerHeader is a grid, and
                        flex-row alone leaves it one — that dropped the close
                        button onto its own row under the title. */}
                    <DrawerHeader className="flex flex-row items-center justify-between text-left">
                        <DrawerTitle>Design System</DrawerTitle>
                        <DrawerClose asChild>
                            <Button
                                variant="ghost"
                                shape="square"
                                size="small"
                                icon="cancel"
                                aria-label="Close menu"
                                // btn-square's w-10 is a component class, so the
                                // base w-full utility beats it and the button
                                // spans the row. The utility has to be passed.
                                className="w-10"
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
