'use client'

import Link from 'next/link'
import { type IconName } from '@/components/Global/Icons/Icon'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'

interface CatalogCardProps {
    title: string
    description: string
    href: string
    icon?: IconName
    status?: 'production' | 'limited' | 'unused' | 'needs-refactor'
    quality?: 1 | 2 | 3 | 4 | 5
    usages?: number
}

// dogfood: a catalog entry IS the DS ListItem anatomy (leading bubble, title,
// body, trailing chevron) — the Link wrapper owns navigation semantics
export function CatalogCard({ title, description, href, icon, status, quality, usages }: CatalogCardProps) {
    return (
        <Link href={href} className="block h-full">
            <ListItem
                position="single"
                className="h-full cursor-pointer transition-colors duration-instant hover:bg-background-disabled active:bg-background-disabled"
                leading={icon ? <IconBubble icon={icon} size="s" color="yellow" /> : undefined}
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
