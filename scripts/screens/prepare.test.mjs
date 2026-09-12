import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepare } from './prepare.mjs'
test('adapter only changes transport allowlist and refuses unknown entry shape', () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-adapter-'))
    try {
        mkdirSync(join(dir, 'src/utils'), { recursive: true })
        mkdirSync(join(dir, 'src/components'), { recursive: true })
        const component = 'export default function Home(){return <h1>Historical title</h1>}'
        writeFileSync(join(dir, 'src/components/Home.tsx'), component)
        writeFileSync(
            join(dir, 'src/utils/api-fetch.ts'),
            'async function callApi(path: string, options?: FetchOptions): Promise<Response> {return fetch(path)}'
        )
        const patch = prepare(dir)
        assert.equal(patch.length, 1)
        assert.equal(readFileSync(join(dir, 'src/components/Home.tsx'), 'utf8'), component)
        assert.equal(prepare(dir).length, 0)
        writeFileSync(join(dir, 'src/utils/api-fetch.ts'), 'unknown historical implementation')
        assert.throws(() => prepare(dir), /unsupported/)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
