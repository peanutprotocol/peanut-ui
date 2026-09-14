'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { SIDEBAR_CONFIG } from './nav-config'

export function DocSidebar() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)

    // Determine which tier we're in
    const tier = pathname?.includes('/foundations')
        ? 'foundations'
        : pathname?.includes('/primitives')
          ? 'primitives'
          : pathname?.includes('/patterns')
            ? 'patterns'
            : pathname?.includes('/audit')
              ? 'audit'
              : pathname?.includes('/playground')
                ? 'playground'
                : null

    const items = tier ? SIDEBAR_CONFIG[tier] : []

    if (!tier || items.length === 0) return null

    return (
        <>
            <Button
                variant="stroke"
                size="small"
                icon="docs"
                className="w-auto md:hidden"
                onClick={() => setIsOpen(true)}
            >
                Menu
            </Button>

            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                <DrawerContent accessibleTitle={`${tier} navigation`} className="md:hidden">
                    <DrawerHeader className="flex-row items-center justify-between text-left">
                        <DrawerTitle className="capitalize">{tier}</DrawerTitle>
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
                    <nav className="pb-6">
                        <SidebarLinks items={items} pathname={pathname} onNavigate={() => setIsOpen(false)} />
                    </nav>
                </DrawerContent>
            </Drawer>

            {/* Desktop sidebar */}
            <nav className="hidden w-48 shrink-0 border-r border-border-disabled pr-4 md:block">
                <SidebarLinks items={items} pathname={pathname} />
            </nav>
        </>
    )
}

function SidebarLinks({
    items,
    pathname,
    onNavigate,
}: {
    items: typeof SIDEBAR_CONFIG.foundations
    pathname: string | null
    onNavigate?: () => void
}) {
    return (
        <div className="flex flex-col gap-4">
            {items.map((item) => {
                const isActive = pathname === item.href
                return (
                    <LinkButton
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={isActive ? 'text-foreground-primary no-underline' : undefined}
                    >
                        <Icon name={item.icon} size={16} />
                        {isActive ? <strong>{item.label}</strong> : item.label}
                    </LinkButton>
                )
            })}
        </div>
    )
}
