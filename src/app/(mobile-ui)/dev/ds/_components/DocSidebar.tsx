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
                className="flex items-center gap-1.5 rounded-sm border border-n-1/20 px-2.5 py-1.5 text-xs font-bold md:hidden"
            >
                <Icon name="docs" size={14} />
                Menu
            </button>

            {/* Mobile overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-40 md:hidden" onClick={() => setIsOpen(false)}>
                    <div className="absolute inset-0 bg-black/20" />
                    <nav
                        className="absolute left-0 top-0 h-full w-64 border-r border-n-1 bg-white p-4 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <span className="text-sm font-bold capitalize">{tier}</span>
                            <button onClick={() => setIsOpen(false)}>
                                <Icon name="cancel" size={16} />
                            </button>
                        </div>
                        <SidebarLinks items={items} pathname={pathname} onNavigate={() => setIsOpen(false)} />
                    </nav>
                </div>
            )}

            {/* Desktop sidebar */}
            <nav className="hidden w-48 shrink-0 border-r border-gray-3 pr-4 md:block">
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
                        className={`flex items-center gap-2 rounded-sm px-3 py-2 text-xs font-bold transition-colors ${
                            isActive ? 'bg-gray-3 text-n-1' : 'text-grey-1 hover:bg-gray-3/50 hover:text-n-1'
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
