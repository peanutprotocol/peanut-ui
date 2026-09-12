const artifactName = /^screen-library-(before|after)-([1-9]\d*)$/

/**
 * Select the newest complete before/after artifact pair from one Actions run.
 * The artifact list is already scoped by run-id by the workflow.
 */
export function selectCapturePair(names, hasCapture = () => true) {
    const attempts = new Map()
    for (const name of names) {
        const match = artifactName.exec(name)
        if (!match) continue
        const [, side, value] = match
        const attempt = Number(value)
        const pair = attempts.get(attempt) ?? {}
        pair[side] = name
        attempts.set(attempt, pair)
    }
    for (const [attempt, pair] of [...attempts.entries()].sort(([a], [b]) => b - a)) {
        if (pair.before && pair.after && hasCapture(pair))
            return {
                attempt,
                before: `incoming/${pair.before}`,
                after: `incoming/${pair.after}`,
            }
    }
    throw new Error('No complete before/after capture artifact pair was found in this run')
}
