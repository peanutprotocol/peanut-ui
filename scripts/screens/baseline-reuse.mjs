import { publicationCapture, validateCapture, sameEnvironment } from './core.mjs'

/** Source-run authentication and asset integrity remain external mandatory checks. */
export function canReuseBaseline(
    beforeInput,
    afterInput,
    expectedBeforeCommit,
    { beforeHarness, sourceHarnessCommit } = {}
) {
    try {
        if (!/^[a-f0-9]{40}$/.test(expectedBeforeCommit)) return false
        const before = publicationCapture(beforeInput),
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
            before.screens.some((screen) => screen.reason === 'Not selected in this diagnostic run') ||
            (beforeHarness !== undefined && sourceHarnessCommit !== expectedBeforeCommit) ||
            !sameEnvironment(before, after, beforeHarness) ||
            before.width !== after.width ||
            before.height !== after.height
        )
            return false
        return true
    } catch {
        return false
    }
}
