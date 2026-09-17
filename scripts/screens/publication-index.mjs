const devPath =
    /^\d{4}-\d{2}-\d{2}\/(?:dev-[a-f0-9]{40}|dev\/(?:en|es-419|es-ar|pt-br)\/[a-f0-9]{40})(?:\/run-[0-9]+-[0-9]+)?$/

const entryLocale = (entry) => entry.locale ?? 'en'
const visualChangeStatuses = new Set(['changed', 'added', 'removed'])
const modernPath =
    /^(\d{4}-\d{2}-\d{2})\/(dev|main|compare-dev|pr-[1-9][0-9]*|compare-main-\d{4}-\d{2}-\d{2})\/(en|es-419|es-ar|pt-br)\/([a-f0-9]{40})(\/run-[0-9]+-[0-9]+)?$/
const isCount = (value) => Number.isSafeInteger(value) && value >= 0

function pathDetails(path) {
    const match = modernPath.exec(path ?? '')
    if (!match) return null
    const [, date, channel, locale, commit, run = ''] = match
    const pr = /^pr-([1-9][0-9]*)$/.exec(channel)
    return {
        date,
        channel,
        locale,
        commit,
        run,
        key: `${date}/${locale}/${commit}${run}`,
        prNumber: pr ? Number(pr[1]) : undefined,
        comparison: channel === 'compare-dev' || channel.startsWith('compare-main-') || Boolean(pr),
        library: channel === 'dev' || channel === 'main',
    }
}

async function mapBounded(values, operation, limit = 8) {
    const output = new Array(values.length)
    let cursor = 0
    await Promise.all(
        Array.from({ length: Math.min(limit, values.length) }, async () => {
            while (cursor < values.length) {
                const index = cursor++
                output[index] = await operation(values[index])
            }
        })
    )
    return output
}

async function cachedEntries(storage) {
    try {
        const bytes = await storage.read('index.json')
        const entries = JSON.parse(bytes.toString('utf8'))
        return new Map((Array.isArray(entries) ? entries : []).map((entry) => [entry.path, entry]))
    } catch {
        return new Map()
    }
}

/** Add compact display metadata without rewriting immutable publication markers. */
export async function enrichEntries(entries, storage) {
    const cached = await cachedEntries(storage)
    const enriched = entries.map((entry) => {
        const prior = cached.get(entry.path) ?? {}
        const details = pathDetails(entry.path)
        const branch = entry.branch ?? prior.branch ?? (details?.library ? details.channel : details?.channel)
        const prNumber = entry.prNumber ?? prior.prNumber ?? details?.prNumber
        const changedScreens = entry.changedScreens ?? prior.changedScreens
        return {
            ...entry,
            ...(branch ? { branch } : {}),
            ...(Number.isSafeInteger(prNumber) && prNumber > 0 ? { prNumber } : {}),
            ...(isCount(changedScreens) ? { changedScreens } : {}),
        }
    })
    const unresolved = enriched.filter((entry) => {
        const details = pathDetails(entry.path)
        return details?.comparison && !isCount(entry.changedScreens)
    })
    const counts = await mapBounded(unresolved, async (entry) => {
        try {
            const report = JSON.parse((await storage.read(`reports/${entry.path}/manifest.json`)).toString('utf8'))
            if (report?.schema !== 1 || report.type !== 'comparison' || !Array.isArray(report.screens)) return undefined
            return report.screens.filter((screen) => visualChangeStatuses.has(screen.status)).length
        } catch {
            return undefined
        }
    })
    for (let index = 0; index < unresolved.length; index++)
        if (isCount(counts[index])) unresolved[index].changedScreens = counts[index]

    const comparisons = new Map()
    for (const entry of enriched) {
        const details = pathDetails(entry.path)
        if (!details?.comparison || !isCount(entry.changedScreens)) continue
        const existing = comparisons.get(details.key)
        if (!existing || (!existing.prNumber && entry.prNumber))
            comparisons.set(details.key, { changedScreens: entry.changedScreens, prNumber: entry.prNumber })
    }
    for (const entry of enriched) {
        const details = pathDetails(entry.path)
        const comparison = details?.library ? comparisons.get(details.key) : undefined
        if (!comparison) continue
        if (!isCount(entry.changedScreens)) entry.changedScreens = comparison.changedScreens
        if (!entry.prNumber && comparison.prNumber) entry.prNumber = comparison.prNumber
    }
    return enriched
}

export function sortEntries(entries) {
    return [...entries].sort(
        (a, b) =>
            (b.sequence ?? 0) - (a.sequence ?? 0) ||
            (b.attempt ?? 0) - (a.attempt ?? 0) ||
            String(b.path).localeCompare(String(a.path))
    )
}

export function selectLatest(entries) {
    const complete = sortEntries(entries).filter((entry) => entry.complete === true && devPath.test(entry.path ?? ''))
    return complete.find((entry) => entryLocale(entry) === 'en') ?? complete[0] ?? null
}

/** Rebuild shared pointers from immutable entry objects after a publication. */
export async function updateIndexes(storage) {
    const entries = []
    let cursor
    do {
        const page = await storage.list({ prefix: 'entries/', cursor })
        for (const blob of page.blobs) entries.push(JSON.parse((await storage.read(blob.pathname)).toString('utf8')))
        cursor = page.cursor
        if (!page.hasMore) break
    } while (cursor)

    const sorted = sortEntries(await enrichEntries(entries, storage))
    const pointerOptions = {
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: 'application/json',
    }
    await storage.put('index.json', JSON.stringify(sorted), pointerOptions)
    const latest = selectLatest(sorted)
    if (latest) await storage.put('latest.json', JSON.stringify({ path: latest.path }), pointerOptions)
    return { entries: sorted, latest }
}
