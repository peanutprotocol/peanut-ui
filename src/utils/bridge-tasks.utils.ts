import type { NextAction } from '@/types/capabilities'

/**
 * The nextActions renderable as pending Bridge verification tasks:
 * `accept-tos` (blocking, rail-attached — or advisory orphan) and
 * `bridge-hosted` (the hosted-flow catch-all). One filter catches both the
 * blocking and the advisory (future-dated, `effectiveDate`-carrying)
 * populations — advisory actions arrive as orphans no rail references, so
 * reading top-level `nextActions` is the only way to see them.
 */
export function selectBridgeTasks(nextActions: NextAction[]): NextAction[] {
    return nextActions.filter((action) => action.kind === 'accept-tos' || action.kind === 'bridge-hosted')
}
