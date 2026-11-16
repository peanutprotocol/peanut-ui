// Owned by the creator-pages work (TASK-24893, the Nita-page session). The /go engine created this stub;
// only that work edits it. Seam: mono inbox/go-links/coordination.md, "Contract" (FROZEN v1).
import type { Metadata } from 'next'
import type { ComponentType } from 'react'
import type { CreatorPageProps } from '@/features/tracked-links/contract'

export type CreatorPageSelection = {
    /** ^[a-z0-9][a-z0-9-]{0,31}$. 'control' with Page null = today's redirect (the control arm). */
    variant: string
    /** Same pattern as variant. Change it whenever variants or weights change. Recorded as page_experiment. */
    experimentId: string
    Page: ComponentType<CreatorPageProps> | null
    /** Title, description, Open Graph. The engine always forces robots noindex, nofollow. */
    metadata?: Metadata
}

/** Server only. Key your registry by linkId, not username. May read cookies(); never sets them. */
export async function selectCreatorPage(_creator: {
    username: string
    linkId: string
}): Promise<CreatorPageSelection | null> {
    return null
}
