'use client'

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { type IconName } from '@/components/Global/Icons/Icon'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'

interface CatalogCardProps {
    title: string
    description: string
    href: string
    /** a product icon name, or a lucide component (what nav-config carries) */
    icon?: IconName | LucideIcon
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    quality?: 1 | 2 | 3 | 4 | 5
    usages?: number
}

// dogfood: a catalog entry IS the DS ListItem anatomy (leading bubble, title,
// body, trailing chevron) — the Link wrapper owns navigation semantics
export function CatalogCard({ title, description, href, icon, status, quality, usages }: CatalogCardProps) {
    // IconBubble takes a name or a ready element; a lucide component is neither
    const LucideGlyph = typeof icon === 'string' ? undefined : icon
    // inline fill:none for the same reason DocNavList sets it: a raw lucide only
    // sets fill as a presentation attribute, which class-level CSS beats.
    const bubbleIcon = LucideGlyph ? (
        <LucideGlyph size={16} aria-hidden style={{ fill: 'none' }} />
    ) : (
        (icon as IconName | undefined)
    )
    return (
        <Link href={href} className="block h-full">
            <ListItem
                position="solo"
                className="h-full cursor-pointer transition-colors duration-instant hover:bg-background-disabled active:bg-background-disabled"
                leading={bubbleIcon ? <IconBubble icon={bubbleIcon} size="s" color="yellow" /> : undefined}
                title={title}
                body={
                    <div>
                        <p>{description}</p>
                        {(status || quality || usages !== undefined) && (
                            <div className="mt-2 flex flex-wrap items-center gap-1">
                                {status && <span className="text-label-m text-foreground-secondary">{status}</span>}
                                {quality && (
                                    <span className="text-body-xs text-foreground-secondary">quality {quality}/5</span>
                                )}
                                {usages !== undefined && (
                                    <span className="text-body-xs">
                                        {usages} usage{usages !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                }
                chevron
            />
        </Link>
    )
}

export function CatalogGrid({ children }: { children: React.ReactNode }) {
    return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{children}</div>
}
