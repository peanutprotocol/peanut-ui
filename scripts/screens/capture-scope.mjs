export function canonicalScope(scope, knownIds) {
    const ids = scope?.screenIds
    if (
        scope?.mode !== 'targeted' ||
        !Array.isArray(ids) ||
        !ids.length ||
        ids.length > 2000 ||
        ids.some((id) => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(id)) ||
        new Set(ids).size !== ids.length ||
        (knownIds && ids.some((id) => !knownIds.has(id)))
    )
        throw new Error('Invalid or unknown targeted screen scope')
    return { mode: 'targeted', screenIds: [...ids].sort() }
}

/** Project coverage explicitly; omitted states convey no evidence about the product. */
export function scopeCapture(capture, plan) {
    const copy = structuredClone(capture)
    if (!Array.isArray(copy?.screens)) throw new Error('Missing capture catalogue')
    const scope = canonicalScope(plan, new Set(copy.screens.map((screen) => screen.id)))
    const selected = new Set(scope.screenIds)
    const screens = copy.screens.filter((screen) => selected.has(screen.id)).sort((a, b) => a.id.localeCompare(b.id))
    if (screens.length !== selected.size) throw new Error('Duplicate capture states in scope')
    const inventory = (copy.inventory ?? [])
        .filter((entry) => entry.screens?.some((id) => selected.has(id)))
        .map((entry) => ({ ...entry, screens: entry.screens.filter((id) => selected.has(id)) }))
    return {
        ...copy,
        screens,
        inventory,
        scope,
        complete: false,
        scopeComplete:
            screens.some((screen) => screen.status === 'captured') &&
            screens.every((screen) => ['captured', 'excluded', 'absent'].includes(screen.status)) &&
            inventory.every((entry) => entry.status !== 'missing'),
    }
}
