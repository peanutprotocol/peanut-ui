const supportedLocales = new Set(['en', 'es-419', 'es-AR', 'pt-BR'])
const reviewableStatuses = new Set(['unchanged', 'changed', 'added', 'new', 'removed', 'excluded', 'absent'])
const settledCaptureStatuses = new Set(['captured', 'excluded', 'absent'])
const missingComponentHarnessReason =
    'This revision has no compatible scenario harness for this component; no newer product code was copied'
const visualSource = /^(?:src\/|public\/|(?:tailwind|postcss)\.config\.)/
const testSource =
    /^(?:src\/dev\/)|(?:^|\/)(?:__tests__|__mocks__|test-utils)\/|\.(?:test|spec)\.[cm]?[jt]sx?$|\.d\.ts$/
const exceptionLine = /^Screen Library exception:[ \t]*(\S[^\r\n]*)$/gm

const hasExceptionReason = (body) => {
    if (typeof body !== 'string') return false
    return [...body.matchAll(exceptionLine)].some((match) => {
        const reason = match[1].trim()
        return !!reason && !/^<[^>]+>$|^(?:tbd|todo)$/i.test(reason)
    })
}

/** A newly registered state may lack a baseline without making the review partial. */
export function reviewableComparison(comparison) {
    const { before, after, screens } = comparison ?? {}
    if (after?.complete !== true || !Array.isArray(screens) || !screens.length) return false
    if (!screens.every((screen) => reviewableStatuses.has(screen.status))) return false
    if (!Array.isArray(before?.inventory) || !before.inventory.length) return false
    if (!before.inventory.every((entry) => ['catalogued', 'excluded'].includes(entry.status))) return false
    if (!Array.isArray(before.screens) || !before.screens.length) return false

    const comparedById = new Map(screens.map((screen) => [screen.id, screen]))
    const hasCapturedBaseline = before.screens.some((screen) => screen.status === 'captured')
    let hasNewHarnessGap = false
    const onlyKnownGaps = before.screens.every((screen) => {
        if (settledCaptureStatuses.has(screen.status)) return true
        const current = comparedById.get(screen.id)
        const newHarnessGap =
            screen.kind === 'component' &&
            screen.status === 'unavailable' &&
            screen.reason === missingComponentHarnessReason &&
            current?.status === 'new' &&
            (current.after?.status === undefined || current.after.status === 'captured')
        hasNewHarnessGap ||= newHarnessGap
        return newHarnessGap
    })
    return hasCapturedBaseline && onlyKnownGaps && (before.complete === true || hasNewHarnessGap)
}

/** Decide whether an exact-head PR review has enough visual coverage to pass. */
export function evaluateZeroDifferenceGate({ event, changedFiles, reports, exception }) {
    if (event !== 'pull_request') return { ok: true, reason: 'No PR visual-coverage gate for integration runs.' }
    if (!Array.isArray(changedFiles) || !changedFiles.every((path) => typeof path === 'string'))
        return { ok: false, reason: 'Cannot verify the changed-file list for this PR.' }
    const uiFiles = changedFiles.filter((path) => visualSource.test(path) && !testSource.test(path))
    if (!uiFiles.length) return { ok: true, reason: 'No UI source files changed.' }

    const seen = new Set()
    if (
        !Array.isArray(reports) ||
        reports.length !== supportedLocales.size ||
        reports.some((report) => {
            if (
                !supportedLocales.has(report?.locale) ||
                seen.has(report.locale) ||
                report.complete !== true ||
                !Number.isInteger(report.changedScreens) ||
                report.changedScreens < 0
            )
                return true
            seen.add(report.locale)
            return false
        })
    )
        return { ok: false, reason: 'UI review needs a complete, unique comparison for every supported locale.' }

    if (reports.some((report) => report.changedScreens > 0))
        return { ok: true, reason: 'Visual differences are present in the Screen Library report.' }
    if (hasExceptionReason(exception))
        return { ok: true, reason: 'Zero visual differences accepted by the explicit PR description exception.' }
    return {
        ok: false,
        reason: 'UI source changed but all four Screen Library reports have zero visual differences. Add a deterministic capture state or put “Screen Library exception: <reason>” on its own line in the PR description, then rerun the check.',
    }
}
