import test from 'node:test'
import assert from 'node:assert/strict'
import { selectLatest, updateIndexes } from './publication-index.mjs'

const sha = (letter) => letter.repeat(40)
const entries = [
    { path: `2026-09-11/pr-3108/${sha('f')}`, complete: true, sequence: 8, attempt: 1 },
    { path: `2026-09-11/dev-${sha('e')}`, complete: false, sequence: 7, attempt: 1 },
    { path: `2026-09-10/dev-${sha('d')}`, complete: true, sequence: 6, attempt: 1 },
]

function memoryStorage({ failLatest = false } = {}) {
    const objects = new Map(
        entries.map((entry) => [`entries/${entry.path.replaceAll('/', '_')}.json`, Buffer.from(JSON.stringify(entry))])
    )
    const calls = []
    let shouldFail = failLatest
    return {
        calls,
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

test('latest ignores newer PR entries and incomplete dev entries', () => {
    assert.equal(selectLatest(entries).path, entries[2].path)
})

test('an interrupted pointer update can be retried safely', async () => {
    const storage = memoryStorage({ failLatest: true })
    await assert.rejects(updateIndexes(storage), /transient/)
    const retry = await updateIndexes(storage)
    assert.equal(retry.latest.path, entries[2].path)
    assert.deepEqual(storage.calls, ['index.json', 'latest.json', 'index.json', 'latest.json'])
    assert.deepEqual(JSON.parse((await storage.read('latest.json')).toString()), { path: entries[2].path })
})
