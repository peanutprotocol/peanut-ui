'use client'

import Link from 'next/link'
import { ListItem } from '@/components/0_Bruddle/ListItem'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LUCIDE_FILL_NONE, SIDEBAR_CONFIG, type NavItem } from './nav-config'

// dogfood: a catalog entry IS the DS ListItem anatomy (leading bubble, title,
// body, trailing chevron) — the Link wrapper owns navigation semantics
function CatalogCard({ label, description, href, icon: Glyph, status, quality, usages }: NavItem) {
    return (
        <Link href={href} className="block h-full">
            <ListItem
                position="solo"
                className="h-full cursor-pointer transition-colors duration-instant hover:bg-background-disabled active:bg-background-disabled"
                // inline fill:none for the same reason DocNavList sets it: a raw lucide only
                // sets fill as a presentation attribute, which class-level CSS beats.
                leading={
                    <IconBubble
                        icon={<Glyph size={16} aria-hidden style={LUCIDE_FILL_NONE} />}
                        size="s"
                        color="yellow"
                    />
                }
                title={label}
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

/** a tier index grid, read from nav-config (the sidebar's source) so the two
    can never disagree. takes the tier key, not the items: lucide components
    cannot cross the RSC boundary, so the server pages pass a string. */
export function TierCatalog({ tier }: { tier: string }) {
    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {SIDEBAR_CONFIG[tier].map((item) => (
                <CatalogCard key={item.href} {...item} />
            ))}
        </div>
    )
}
