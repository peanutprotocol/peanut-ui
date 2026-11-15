// The ids live apart from experiments.ts because the client shell needs them, and
// experiments.ts imports the page components, which import the shell.

/** Change a creator's id whenever its variants or weights change: a new id re-randomises visitors and separates the results. */
export const CREATOR_PAGE_EXPERIMENT_IDS: Record<string /* username */, string> = {
    juanacervio: 'nita-2026-11-a',
}

export function creatorPageExperimentId(username: string): string | null {
    return Object.hasOwn(CREATOR_PAGE_EXPERIMENT_IDS, username) ? CREATOR_PAGE_EXPERIMENT_IDS[username] : null
}
