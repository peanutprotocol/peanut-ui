import test from 'node:test'
import assert from 'node:assert/strict'
import { selectLatest, updateIndexes } from './publication-index.mjs'

const sha = (letter) => letter.repeat(40)
const entries = [
    { path: `2026-09-11/pr-3108/${sha('f')}`, complete: true, sequence: 8, attempt: 1 },
    { path: `2026-09-11/dev-${sha('e')}`, complete: false, sequence: 7, attempt: 1 },
    { path: `2026-09-10/dev-${sha('d')}`, complete: true, sequence: 6, attempt: 1 },
]

function memoryStorage({ failLatest = false, sourceEntries = entries, reports = {} } = {}) {
    const objects = new Map(
        sourceEntries.map((entry) => [
            `entries/${entry.path.replaceAll('/', '_')}.json`,
            Buffer.from(JSON.stringify(entry)),
        ])
    )
    for (const [path, report] of Object.entries(reports))
        objects.set(`reports/${path}/manifest.json`, Buffer.from(JSON.stringify(report)))
    const calls = []
    let shouldFail = failLatest
    return {
        calls,
        objects,
        async list({ prefix }) {
            return {
                blobs: [...objects.keys()]
                    .filter((pathname) => pathname.startsWith(prefix))
                    .map((pathname) => ({ pathname })),
                hasMore: false,
            }
        },
        async read(pathname) {
            return objects.get(pathname)
        },
        async put(pathname, body) {
            calls.push(pathname)
            if (pathname === 'latest.json' && shouldFail) {
                shouldFail = false
                throw new Error('transient storage failure')
            }
            objects.set(pathname, Buffer.from(body))
        },
    }
}

test('index backfills card metadata and shares comparison counts with its full dev library', async () => {
    const commit = sha('a')
    const run = 'run-42-1'
    const prPath = `2026-09-15/pr-3166/en/${commit}/${run}`
    const devLibraryPath = `2026-09-15/dev/en/${commit}/${run}`
    const sourceEntries = [
        { path: prPath, date: '2026-09-15', locale: 'en', complete: true, sequence: 42 },
        { path: devLibraryPath, date: '2026-09-15', locale: 'en', complete: true, sequence: 42 },
    ]
    const storage = memoryStorage({
        sourceEntries,
        reports: {
            [prPath]: {
                schema: 1,
                type: 'comparison',
                screens: [
                    { status: 'changed' },
                    { status: 'added' },
                    { status: 'removed' },
                    { status: 'unchanged' },
                    { status: 'absent' },
                ],
            },
        },
    })
    const { entries: indexed } = await updateIndexes(storage)
    const prEntry = indexed.find((entry) => entry.path === prPath)
    const devEntry = indexed.find((entry) => entry.path === devLibraryPath)
    assert.deepEqual(
        { branch: prEntry.branch, prNumber: prEntry.prNumber, changedScreens: prEntry.changedScreens },
        { branch: 'pr-3166', prNumber: 3166, changedScreens: 3 }
    )
    assert.deepEqual(
        { branch: devEntry.branch, prNumber: devEntry.prNumber, changedScreens: devEntry.changedScreens },
        { branch: 'dev', prNumber: 3166, changedScreens: 3 }
    )
})

test('latest ignores newer PR entries and incomplete dev entries', () => {
    assert.equal(selectLatest(entries).path, entries[2].path)
})

test('latest prefers the English locale when the dev catalogue has a locale matrix', () => {
    const matrix = ['es-419', 'pt-br', 'en'].map((locale) => ({
        path: `2026-09-12/dev/${locale}/${sha('e')}`,
        locale: locale === 'es-419' ? 'es-419' : locale === 'pt-br' ? 'pt-BR' : 'en',
        complete: true,
        sequence: 9,
        attempt: 1,
    }))
    assert.equal(selectLatest(matrix).locale, 'en')
})

test('a newer Nutcracker run does not replace the latest deterministic app catalogue', () => {
    const nutcracker = {
        path: `2026-09-14/nutcracker/en/${sha('a')}/run-99-1`,
        source: 'nutcracker',
        complete: true,
        sequence: 99,
        attempt: 1,
    }
    assert.equal(selectLatest([...entries, nutcracker]).path, entries[2].path)
})

test('an interrupted pointer update can be retried safely', async () => {
    const storage = memoryStorage({ failLatest: true })
    await assert.rejects(updateIndexes(storage), /transient/)
    const retry = await updateIndexes(storage)
    assert.equal(retry.latest.path, entries[2].path)
    assert.deepEqual(storage.calls, ['index.json', 'latest.json', 'index.json', 'latest.json'])
    assert.deepEqual(JSON.parse((await storage.read('latest.json')).toString()), { path: entries[2].path })
})
