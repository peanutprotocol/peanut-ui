/**
 * Persistence for the copy-review verdicts on /dev/journey.
 *
 * Pure functions only — the hook (useCopyReview) owns localStorage access, this
 * module owns the shape, so the "did Hugo already check this render?" logic is
 * unit-testable without a DOM.
 *
 * A render is identified by `${eventType}#${exampleIndex}` (see emailReview.ts),
 * so the two first_spend copy variants are reviewed independently.
 */

/** Only reviewed ids are stored; absence means "still needs a verdict". */
export type CopyReviewState = Record<string, true>

/** Namespaced and versioned: bumping the suffix retires stale verdicts wholesale. */
export const COPY_REVIEW_STORAGE_KEY = 'journey-copy-review-v1'

/** Tolerates every shape a hand-edited or pre-versioned localStorage value can take. */
export function parseCopyReviewState(raw: string | null): CopyReviewState {
    if (!raw) return {}
    try {
        const parsed: unknown = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
        const state: CopyReviewState = {}
        for (const [id, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (value === true) state[id] = true
        }
        return state
    } catch {
        return {}
    }
}

export function serializeCopyReviewState(state: CopyReviewState): string {
    return JSON.stringify(state)
}

export function toggleCopyReview(state: CopyReviewState, id: string): CopyReviewState {
    const next = { ...state }
    if (next[id]) delete next[id]
    else next[id] = true
    return next
}

/**
 * Counted against the ids that currently exist on the board, so verdicts left
 * over from a renamed/removed email never inflate the "N/13 checked" progress.
 */
export function countReviewed(state: CopyReviewState, ids: string[]): number {
    return ids.reduce((total, id) => (state[id] ? total + 1 : total), 0)
}
