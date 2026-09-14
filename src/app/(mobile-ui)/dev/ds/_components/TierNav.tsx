'use client'

import { usePathname } from 'next/navigation'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { Icon } from '@/components/Global/Icons/Icon'
import { TIERS } from './nav-config'

export function TierNav() {
    const pathname = usePathname()

    return (
        <nav className="flex flex-wrap gap-x-6 gap-y-4" aria-label="Design system sections">
            {TIERS.map((tier) => {
                const isActive = pathname?.startsWith(tier.href)
                return (
                    <LinkButton
                        key={tier.href}
                        href={tier.href}
                        className={isActive ? 'text-foreground-primary no-underline' : undefined}
                    >
                        <Icon name={tier.icon} size={16} />
                        {isActive ? <strong>{tier.label}</strong> : tier.label}
                    </LinkButton>
                )
            })}
        </nav>
    )
}
