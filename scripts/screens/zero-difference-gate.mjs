const supportedLocales = new Set(['en', 'es-419', 'es-AR', 'pt-BR'])
const reviewableStatuses = new Set(['unchanged', 'changed', 'added', 'new', 'removed', 'excluded', 'absent'])
const visualSource =
    /^(?:src\/(?:app|assets|components|features|content|hooks|i18n|utils|constants|styles)\/|public\/|(?:tailwind|postcss)\.config\.)/
const testSource = /(?:^|\/)(?:__tests__|__mocks__|test-utils)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/
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
    return (
        comparison?.after?.complete === true &&
        Array.isArray(comparison?.screens) &&
        comparison.screens.length > 0 &&
        comparison.screens.every((screen) => reviewableStatuses.has(screen.status))
    )
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
