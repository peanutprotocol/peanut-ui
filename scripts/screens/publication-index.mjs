const devPath = /^\d{4}-\d{2}-\d{2}\/dev-[a-f0-9]{40}(?:\/run-[0-9]+-[0-9]+)?$/

export function sortEntries(entries) {
    return [...entries].sort(
        (a, b) =>
            (b.sequence ?? 0) - (a.sequence ?? 0) ||
            (b.attempt ?? 0) - (a.attempt ?? 0) ||
            String(b.path).localeCompare(String(a.path))
    )
}

export function selectLatest(entries) {
    return sortEntries(entries).find((entry) => entry.complete === true && devPath.test(entry.path ?? '')) ?? null
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

    const sorted = sortEntries(entries)
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
