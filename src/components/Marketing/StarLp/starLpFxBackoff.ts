/** After a failed read of a pair, renders skip reading it for this long (ms). */
export const STAR_LP_FX_BACKOFF_MS = 60_000

/**
 * Per server instance: a pair's read ("USD|ARS|cold", "USD|ARS|refresh") →
 * the time (ms) before which no render tries that read again. Set on a failed
 * read; it simply runs out. During an outage, at most one render a minute
 * waits on the API for each read.
 */
export const starLpFxBackoff = new Map<string, number>()
