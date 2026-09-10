'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/Global/Icons/Icon'
import { TIERS } from './nav-config'

export function TierNav() {
    const pathname = usePathname()

    return (
        <div className="flex gap-1">
            {TIERS.map((tier) => {
                const isActive = pathname?.startsWith(tier.href)
                return (
                    <Link
                        key={tier.href}
                        href={tier.href}
                        // active state borrows SegmentedControl's vocabulary
                        // (action-primary border + tint); these stay Links, not
                        // radix tabs — SegmentedControl bans content-tab use
                        className={`flex items-center gap-1 rounded-sm border px-3 py-2 text-label-m transition-colors duration-fast ${
                            isActive
                                ? 'border-action-primary bg-action-primary/10 text-foreground-primary'
                                : 'border-border-disabled text-foreground-secondary hover:border-border-subtle hover:bg-background-disabled'
                        }`}
                    >
                        <Icon name={tier.icon} size={14} />
                        {tier.label}
                    </Link>
                )
            })}
        </div>
    )
}
