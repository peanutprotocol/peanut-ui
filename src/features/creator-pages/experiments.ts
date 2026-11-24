// How to change the split, add a creator and read the result: mono engineering/ui/creator-pages.md
// Plain data per creator, no components: the route reads the title and the experiment from here, and the components live in page-components.ts.

export type CreatorPageExperiment = {
    /** Must pass `isCreatorPageLabel` (`^[a-z0-9][a-z0-9-]{0,31}$`). Recorded as `experiment_id`. Change it whenever the variants or weights below change: a new id re-randomises visitors and separates the results. */
    id: string
    /**
     * The browser-tab title, which an in-app browser shows in its top bar. One per creator, the same
     * for every variant, so the arms do not differ before the page is seen. It is copy, not part of
     * the test: changing it needs no new experiment id.
     */
    title: string
    variants: {
        /** Same rule. Recorded as `variant`. Its component is in page-components.ts. */
        id: string
        /** Share of new visitors, relative to the other weights. 0 parks the variant. */
        weight: number
    }[]
}

/** One entry per creator, keyed by lowercase username. A creator without an entry is sent to /invite?code=<username>. */
export const CREATOR_PAGE_EXPERIMENTS: Record<string, CreatorPageExperiment> = {
    juanacervio: {
        id: 'nita-2026-11-a',
        title: 'Invitación de Nita',
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
