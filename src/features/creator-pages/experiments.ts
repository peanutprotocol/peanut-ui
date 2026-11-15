// How to change a page or the split, add a creator and read the result: mono engineering/ui/creator-pages.md
import type { ComponentType } from 'react'
import { CREATOR_PAGE_EXPERIMENT_IDS } from './experiment-ids'
import { NitaA1 } from './pages/juanacervio/NitaA1'
import { NitaE1 } from './pages/juanacervio/NitaE1'
import { NitaG2 } from './pages/juanacervio/NitaG2'
import type { CreatorPageProps } from './types'

export type CreatorPageVariant = {
    /** `^[a-z0-9][a-z0-9-]{0,31}$`. Recorded as `page_variant`. */
    id: string
    /** Share of new visitors, relative to the other weights. 0 parks the variant. */
    weight: number
    Page: ComponentType<CreatorPageProps>
}

export type CreatorPageExperiment = {
    /** From experiment-ids.ts. Change it there whenever variants or weights change here. */
    id: string
    variants: CreatorPageVariant[]
}

/** One entry per creator, keyed by lowercase username. A creator without an entry gets the generic store page. */
export const CREATOR_PAGE_EXPERIMENTS: Record<string, CreatorPageExperiment> = {
    juanacervio: {
        id: CREATOR_PAGE_EXPERIMENT_IDS.juanacervio,
        variants: [
            { id: 'a1', weight: 1, Page: NitaA1 },
            { id: 'g2', weight: 1, Page: NitaG2 },
            { id: 'e1', weight: 1, Page: NitaE1 },
        ],
    },
}
