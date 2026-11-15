// How to change the split, add a creator and read the result: mono engineering/ui/creator-pages.md
// Plain data, no components: the shell reads the experiment id from here, and the page components import the shell.

export type CreatorPageExperiment = {
    /** `^[a-z0-9][a-z0-9-]{0,31}$`. Recorded as `page_experiment`. Change it whenever the variants or weights below change: a new id re-randomises visitors and separates the results. */
    id: string
    variants: {
        /** Same pattern. Recorded as `page_variant`. Its component is in page-components.ts. */
        id: string
        /** Share of new visitors, relative to the other weights. 0 parks the variant. */
        weight: number
    }[]
}

/** One entry per creator, keyed by lowercase username. A creator without an entry gets the generic store page. */
export const CREATOR_PAGE_EXPERIMENTS: Record<string, CreatorPageExperiment> = {
    juanacervio: {
        id: 'nita-2026-11-a',
        variants: [
            { id: 'a1', weight: 1 },
            { id: 'g2', weight: 1 },
            { id: 'e1', weight: 1 },
        ],
    },
}

export function creatorPageExperiment(username: string): CreatorPageExperiment | null {
    // hasOwn: a username such as `constructor` must not resolve to an Object.prototype member.
    return Object.hasOwn(CREATOR_PAGE_EXPERIMENTS, username) ? CREATOR_PAGE_EXPERIMENTS[username] : null
}
