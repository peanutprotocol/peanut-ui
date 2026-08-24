/**
 * Tag marking an event as an explicit capture from a money-moving flow (send,
 * withdraw, card spend). `beforeSendHandler` exempts tagged events from the
 * noise filters in sentry.utils.ts, because there the "noise" IS the signal:
 * a send that dies on a failed fetch was being dropped by the `networkIssues`
 * filter, leaving the user with "contact support" and us with nothing to look
 * at.
 *
 * Its own module rather than sentry.utils.ts: the root file is loaded by the
 * server and edge configs too, so it must not reach into app-layer modules.
 */
export const CRITICAL_FLOW_TAG = 'critical_flow'

export function criticalFlowTags(flow: string): Record<string, string> {
    return { [CRITICAL_FLOW_TAG]: flow }
}
