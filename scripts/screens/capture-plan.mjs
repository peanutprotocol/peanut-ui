const validPath = (path) =>
    typeof path === 'string' &&
    path.length > 0 &&
    path.length <= 4096 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !/[\x00-\x1f\x7f]/.test(path) &&
    path.split('/').every((part) => part && part !== '.' && part !== '..')
// The scripts/ entries are exactly what the capture build executes; capture-build-inputs.test.mjs derives and checks them.
const globalSource =
    /^(?:public\/(?!screen-library\/)|src\/(?:.*\/__fixtures__\/|content(?:\/|$)|i18n\/|dev\/|context\/|hooks\/|services\/)|scripts\/(?:screens\/|next-font-google\/|copy-flags\.mjs$|generate-legal-versions\.mjs$)|\.github\/workflows\/screen-library[^/]*\.ya?ml$|(?:pnpm-lock\.yaml|package(?:-lock)?\.json|(?:next|tailwind|postcss)\.config\.[^/]+)$)/

export const galleryMaintenanceChange = (path) =>
    validPath(path) &&
    /^(?:public\/screen-library\/|scripts\/screens\/(?:worker\/|collection-worker\/|mcp\/|deploy\/|(?:publication-index|rebuild-index)\.mjs$)|\.github\/workflows\/screen-library-gallery\.yml$)/.test(
        path
    )
export const galleryIndexChange = (path) => /^scripts\/screens\/(?:publication-index|rebuild-index)\.mjs$/.test(path)

/** Marketing site and content: no captured state renders them (capture-marketing.test.mjs proves it). */
export const marketingOnly = (path) =>
    validPath(path) &&
    /^src\/(?:content(?:\/|$)|app\/(?:\[locale\]\/|(?:es-419|es-ar|pt-br)\/|page\.tsx$|api\/og\/marketing\/)|components\/Marketing\/|i18n\/(?:(?:en|es-419|es-ar|pt-br)\.json|app\/(?:messages\/[^/]+\.marketing\.json|marketing-namespaces\.json|messages\.marketing\.ts|MarketingIntlProvider\.tsx))$)/.test(
        path
    )

/** Deliberate allowlist. Unknown configuration, fixtures and runtime code are visual. */
export function knownNonvisual(path) {
    if (!validPath(path)) return false
    if (/(?:^|\/)(?:__tests__|__mocks__|test-utils)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(path)) return true
    if (galleryMaintenanceChange(path)) return true
    if (marketingOnly(path)) return true
    if (globalSource.test(path)) return false
    if (/(?:^|\/)__fixtures__\//.test(path)) return false
    return /^(?:docs\/|[^/]+\.md$|e2e\/|public\/screen-library\/|\.github\/workflows\/|scripts\/|android\/|ios\/|\.codex\/)/.test(
        path
    )
}

export function planCapture({ event, branch, changedFiles, screens, dependencies } = {}) {
    if (!Array.isArray(screens) || !screens.length || screens.length > 2000) throw new Error('Invalid screen catalogue')
    const seen = new Set()
    for (const screen of screens) {
        if (
            !/^[a-z0-9][a-z0-9-]{0,119}$/.test(screen?.id) ||
            seen.has(screen.id) ||
            typeof screen.flow !== 'string' ||
            !screen.flow.trim() ||
            !Array.isArray(screen.sources) ||
            !screen.sources.every(validPath)
        )
            throw new Error('Invalid screen impact roots')
        seen.add(screen.id)
    }
    const all = [...seen].sort()
    const full = (reason) => ({ mode: 'full', screenIds: all, reasons: [reason] })
    if (!['pull_request', 'push', 'workflow_dispatch'].includes(event) || typeof branch !== 'string')
        return full('Unknown capture event or branch')
    if (event === 'workflow_dispatch') return full('Manual capture retains full coverage')
    if (
        !Array.isArray(changedFiles) ||
        !changedFiles.length ||
        changedFiles.length > 100000 ||
        !changedFiles.every(validPath)
    )
        return full('Changed-file evidence is missing or invalid')
    const changed = [...new Set(changedFiles)].filter((path) => !knownNonvisual(path)).sort()
    if (!changed.length) return { mode: 'skip', screenIds: [], reasons: ['Only known nonvisual files changed'] }
    if (event === 'push') return full('Integration and release snapshots retain full coverage')
    if (changed.some((path) => globalSource.test(path) || !/^src\/.+\.[cm]?[jt]sx?$/.test(path)))
        return full('Shared runtime, capture infrastructure or unknown path changed')
    if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies))
        return full('Dependency graph is unavailable')
    const affectedFlows = new Set()
    const reached = new Set()
    let traversed = 0
    for (const screen of [...screens].sort((a, b) => a.id.localeCompare(b.id))) {
        if (!screen.sources.length) return full('A registered state has unknown source roots')
        const pending = [...screen.sources],
            visited = new Set()
        while (pending.length) {
            const path = pending.pop()
            if (visited.has(path)) continue
            if (++traversed > 1000000) return full('Dependency traversal exceeded its explicit budget')
            visited.add(path)
            reached.add(path)
            const edges = dependencies[path]
            if (!Array.isArray(edges) || !edges.every(validPath)) return full(`Unknown dependency influence: ${path}`)
            for (const dependency of edges) if (!visited.has(dependency)) pending.push(dependency)
        }
        if (changed.some((path) => visited.has(path))) affectedFlows.add(screen.flow)
    }
    if (changed.some((path) => !reached.has(path))) return full('Changed source is not mapped to a registered state')
    const selected = screens
        .filter((screen) => affectedFlows.has(screen.flow))
        .map((screen) => screen.id)
        .sort()
    if (!selected.length || selected.length === all.length) return full('Impact covers all flows or is unknown')
    return { mode: 'targeted', screenIds: selected, reasons: ['All states in every transitively affected flow'] }
}
