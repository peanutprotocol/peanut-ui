import type { RecoverableToken } from '@/types/recover-funds'

/**
 * Tokens support found stranded that neither our token list nor Rhino's has,
 * by chain id. An entry makes that token recoverable on /recover-funds without
 * adding it to the token pickers, which read token-details.json. Empty at
 * first (TASK-23850): every token named in the wrong-deposit reports on the
 * recoverable chains is on one of the two lists.
 */
export const RECOVER_FUNDS_EXTRA_TOKENS: Readonly<Record<string, readonly RecoverableToken[]>> = {}
