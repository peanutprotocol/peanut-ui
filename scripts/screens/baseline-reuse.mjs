import { validateCapture, sameEnvironment } from './core.mjs'

/** Source-run authentication and asset integrity remain external mandatory checks. */
export function canReuseBaseline(beforeInput, afterInput, expectedBeforeCommit, expectedFixtures) {
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
            (after.fixtureSource !== undefined &&
                (!/^[a-f0-9]{64}$/.test(expectedFixtures ?? '') || before.fixtureSource !== expectedBeforeCommit)) ||
            !sameEnvironment(before, after.fixtureSource ? { ...after, fixtures: expectedFixtures } : after) ||
            before.width !== after.width ||
            before.height !== after.height
        )
            return false
        const baseline = new Map(before.screens.map((screen) => [screen.id, screen]))
        return after.screens.every((screen) => baseline.has(screen.id))
    } catch {
        return false
    }
}
