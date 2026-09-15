'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { Drawer, DrawerClose, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { SIDEBAR_CONFIG, TIERS } from './nav-config'

export function DocSidebar() {
    const pathname = usePathname()
    const [isOpen, setIsOpen] = useState(false)

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
                <DrawerContent accessibleTitle="Design system navigation" className="md:hidden">
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
                    <nav className="pb-6">
                        <SidebarSections pathname={pathname} onNavigate={() => setIsOpen(false)} />
                    </nav>
                </DrawerContent>
            </Drawer>

            {/* Desktop sidebar */}
            <nav className="hidden w-48 shrink-0 border-r border-border-disabled pr-4 md:block">
                <SidebarSections pathname={pathname} />
            </nav>
        </>
    )
}

function SidebarSections({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
    return (
        <div className="flex flex-col gap-8">
            {TIERS.map((tier) => {
                const isActive = pathname?.startsWith(tier.href)
                const items = SIDEBAR_CONFIG[tier.href.split('/').pop() as keyof typeof SIDEBAR_CONFIG] ?? []
                return (
                    <div key={tier.href} className="flex flex-col gap-7">
                        <LinkButton
                            href={tier.href}
                            onClick={onNavigate}
                            className={isActive ? 'text-foreground-primary no-underline' : undefined}
                        >
                            <Icon name={tier.icon} size={16} />
                            {isActive ? <strong>{tier.label}</strong> : tier.label}
                        </LinkButton>
                        <SidebarLinks items={items} pathname={pathname} onNavigate={onNavigate} />
                    </div>
                )
            })}
        </div>
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
        // gap-7: LinkButton's 44px pseudo hit area extends ±14px, so stacked
        // instances need ~28px between baselines or their targets overlap
        <div className="flex flex-col gap-7">
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
