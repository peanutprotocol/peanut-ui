import { validateCapture, sameEnvironment } from './core.mjs'

/** Source-run authentication and asset integrity remain external mandatory checks. */
export function canReuseBaseline(
    beforeInput,
    afterInput,
    expectedBeforeCommit,
    { beforeHarness, sourceHarnessCommit } = {}
) {
    try {
        if (!/^[a-f0-9]{40}$/.test(expectedBeforeCommit)) return false
        const before = validateCapture(beforeInput),
            after = validateCapture(afterInput)
        if (
            !before.environment.trim() ||
            !before.adapter.trim() ||
            !before.publicBase ||
            !Number.isFinite(Date.parse(before.capturedAt))
        )
            return false
        const origin = new URL(before.publicBase)
        if (!['https:', 'http:'].includes(origin.protocol)) return false
        if (
            before.commit !== expectedBeforeCommit ||
            before.scope ||
            !before.complete ||
            (beforeHarness !== undefined && sourceHarnessCommit !== expectedBeforeCommit) ||
            !sameEnvironment(before, after, beforeHarness) ||
            before.width !== after.width ||
            before.height !== after.height
        )
            return false
        // A base-harness before follows the base catalogue, so screens the PR adds are absent from it by design.
        if (beforeHarness) return true
        const baseline = new Map(before.screens.map((screen) => [screen.id, screen]))
        return after.screens.every((screen) => baseline.has(screen.id))
    } catch {
        return false
    }
}
