const artifactName = /^screen-library-(before|after)(?:-(en|es-419|es-AR|pt-BR))?-([1-9]\d*)$/

export function parseCaptureArtifact(name) {
    const match = artifactName.exec(name)
    if (!match) return null
    return { side: match[1], locale: match[2] ?? 'en', explicitLocale: Boolean(match[2]), attempt: Number(match[3]) }
}

export function selectCaptureArtifact(names, side, hasCapture = () => true, wantedLocale = 'en') {
    const attempts = new Map()
    for (const name of names) {
        const match = parseCaptureArtifact(name)
        if (!match || match.side !== side || match.locale !== wantedLocale) continue
        const attempt = match.attempt
        const current = attempts.get(attempt)
        if (!current || match.explicitLocale || !current.explicitLocale)
            attempts.set(attempt, { name, explicitLocale: match.explicitLocale })
    }
    for (const [attempt, selected] of [...attempts.entries()].sort(([a], [b]) => b - a))
        if (hasCapture(selected.name)) return { attempt, name: `incoming/${selected.name}` }
    throw new Error(`No valid ${side} capture artifact was found in this run`)
}

/**
 * Select the newest complete before/after artifact pair from one Actions run.
 * The artifact list is already scoped by run-id by the workflow.
 */
export function selectCapturePair(names, hasCapture = () => true) {
    const pairs = selectCapturePairs(names, hasCapture)
    if (pairs.length !== 1)
        throw new Error(
            pairs.length
                ? 'Expected one before/after capture artifact pair'
                : 'No complete before/after capture artifact pair was found in this run'
        )
    const { attempt, before, after } = pairs[0]
    return { attempt, before, after }
}

/** Select the newest complete pair for every locale present in one Actions run. */
export function selectCapturePairs(names, hasCapture = () => true) {
    const attempts = new Map()
    for (const name of names) {
        const match = parseCaptureArtifact(name)
        if (!match) continue
        const localeAttempts = attempts.get(match.locale) ?? new Map()
        const pair = localeAttempts.get(match.attempt) ?? {}
        const current = pair[match.side]
        if (!current || match.explicitLocale || !current.explicitLocale)
            pair[match.side] = { name, explicitLocale: match.explicitLocale }
        localeAttempts.set(match.attempt, pair)
        attempts.set(match.locale, localeAttempts)
    }
    const pairs = []
    for (const [locale, localeAttempts] of attempts) {
        for (const [attempt, pair] of [...localeAttempts.entries()].sort(([a], [b]) => b - a)) {
            if (pair.before && pair.after && hasCapture({ before: pair.before.name, after: pair.after.name })) {
                pairs.push({
                    locale,
                    attempt,
                    before: `incoming/${pair.before.name}`,
                    after: `incoming/${pair.after.name}`,
                })
                break
            }
        }
    }
    return pairs.sort((a, b) => a.locale.localeCompare(b.locale))
}
