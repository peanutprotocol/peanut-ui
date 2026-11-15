import type { AskId } from './types'

/*
 * Module-level, import-free: the push store reads it, and the provider
 * imports the push hook through the journey state, so this cannot live in
 * AttentionProvider without a cycle.
 */
let sessionInterrupts: { userId: string | null; ids: AskId[]; open: AskId | null } = {
    userId: null,
    ids: [],
    open: null,
}

export const getSessionInterrupts = () => sessionInterrupts
export const setSessionInterrupts = (next: typeof sessionInterrupts) => {
    sessionInterrupts = next
}

/** The push store refuses a money-moment pre-prompt while a manager surface is up. */
export const isAttentionInterruptOpen = (): boolean => sessionInterrupts.open !== null
