'use client'

import { useId, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { BaseInput } from '@/components/0_Bruddle/BaseInput'
import { LINK_BUTTON_CLASSES } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { filterNav, LUCIDE_FILL_NONE } from './nav-config'
import { twMerge } from '@/utils/tw'

/**
 * The whole nav tree — every tier with its entries — plus the search box that
 * filters it. Rendered by the desktop sidebar and by the mobile drawer, so the
 * two can never show a different nav.
 */
export function DocNavList({ onNavigate }: { onNavigate?: () => void }) {
    const pathname = usePathname()
    // deliberate exception to the URL-as-state rule: this filter is ephemeral dev-tool
    // UI, the list stays mounted across navigation, and a shared /dev/ds link should
    // open the page, not someone's half-typed search.
    const [query, setQuery] = useState('')
    const searchId = useId()
    const groups = filterNav(query)

    return (
        <div className="flex flex-col gap-6">
            <div>
                <label htmlFor={searchId} className="sr-only">
                    Search the design system
                </label>
                <BaseInput
                    id={searchId}
                    size="sm"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search"
                    autoComplete="off"
                    leftContent={<Icon name="search" size={16} aria-hidden />}
                />
            </div>

            {/* status so a screen reader hears the empty result without moving focus.
                mounted on every render, empty and sr-only while there are results: a
                live region that appears together with its text is not announced, and
                sr-only takes it out of flow so it adds no gap to the column. */}
            <p
                role="status"
                className={twMerge('text-body-xs text-foreground-secondary', groups.length > 0 && 'sr-only')}
            >
                {groups.length === 0 ? `No entry matches “${query.trim()}”.` : ''}
            </p>

            {groups.map((group) => (
                <div key={group.tier.href} className="flex min-w-0 flex-col">
                    <NavRow
                        href={group.tier.href}
                        icon={group.tier.icon}
                        label={group.tier.label}
                        isActive={!!pathname?.startsWith(group.tier.href)}
                        isTier
                        onNavigate={onNavigate}
                    />
                    {group.items.map((item) => (
                        <NavRow
                            key={item.href}
                            href={item.href}
                            icon={item.icon}
                            label={item.label}
                            isActive={pathname === item.href}
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            ))}
        </div>
    )
}

// a plain Link wearing the LinkButton chrome: the component itself takes no
// aria-current, and the active row must announce itself.
// min-h-11 owns the 44px target; the ±14px pseudo is squashed so flush-stacked
// rows cannot overlap hit areas.
function NavRow({
    href,
    icon: RowIcon,
    label,
    isActive,
    isTier,
    onNavigate,
}: {
    href: string
    icon: LucideIcon
    label: string
    isActive: boolean
    /** tier row — doubles as the group heading above its entries */
    isTier?: boolean
    onNavigate?: () => void
}) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={twMerge(
                LINK_BUTTON_CLASSES,
                'min-h-11 min-w-0 items-center gap-2 py-1 text-left after:inset-y-0',
                isTier && 'text-label-m uppercase',
                isActive && 'text-foreground-primary no-underline'
            )}
        >
            {/* inline fill:none — a raw lucide sets fill only as a presentation
                attribute, which `.btn svg { fill: inherit }` beats. The product
                Icon wrapper does the same; these nav rows bypass it. */}
            <RowIcon size={16} aria-hidden className="shrink-0" style={LUCIDE_FILL_NONE} />
            {isActive ? <strong>{label}</strong> : label}
        </Link>
    )
}
