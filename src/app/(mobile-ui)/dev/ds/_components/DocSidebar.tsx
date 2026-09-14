'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/Global/Icons/Icon'
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
            {/* Mobile hamburger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 rounded-sm border border-border-subtle px-2 py-2 text-label-m md:hidden"
            >
                <Icon name="docs" size={14} />
                Menu
            </button>

            {/* Mobile overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-foreground-primary/20" />
                    <nav
                        className="absolute top-0 left-0 h-full w-64 border-r border-border-default bg-background-default p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-label-l capitalize">{tier}</span>
                            <button onClick={() => setIsOpen(false)}>
                                <Icon name="cancel" size={16} />
                            </button>
                        </div>
                        <SidebarLinks items={items} pathname={pathname} onNavigate={() => setIsOpen(false)} />
                    </nav>
                </div>
            )}

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
        <div className="flex flex-col gap-0.5">
            {items.map((item) => {
                const isActive = pathname === item.href
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        className={`flex items-center gap-2 rounded-sm px-3 py-2 text-label-m transition-colors duration-fast ${
                            isActive
                                ? 'bg-background-disabled text-foreground-primary'
                                : 'text-foreground-secondary hover:bg-background-disabled hover:text-foreground-primary'
                        }`}
                    >
                        <Icon name={item.icon} size={14} />
                        {item.label}
                    </Link>
                )
            })}
        </div>
    )
}
