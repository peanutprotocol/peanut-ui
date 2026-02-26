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
                        className={`flex items-center gap-1.5 rounded-sm border px-3 py-2 text-xs font-bold transition-colors ${
                            isActive
                                ? 'border-n-1 bg-n-1 text-white'
                                : 'border-gray-3 text-grey-1 hover:border-gray-4 hover:bg-gray-3/50'
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
