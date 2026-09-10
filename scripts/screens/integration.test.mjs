import test from 'node:test'
import assert from 'node:assert/strict'
import { integrationBase } from './integration.mjs'
const id = (n) => n.repeat(40)
function executor({ parents, original = [], patches = {} }) {
    return (tool, args, options) => {
        if (tool === 'git') return `${patches[options.input] ?? options.input} 0000`
        const path = args[1].replace('repos/test/repo/', '')
        if (path === `commits/${id('c')}/pulls`)
            return JSON.stringify([{ number: 1, merged_at: 'date', merge_commit_sha: id('c'), base: { ref: 'dev' } }])
        if (path.startsWith('pulls/')) return JSON.stringify([original.map((sha) => ({ sha }))])
        const sha = path.replace('commits/', '')
        if (args.includes('Accept: application/vnd.github.diff')) return sha
        return JSON.stringify({ parents: (parents[sha] ?? []).map((sha) => ({ sha })) })
    }
}
test('merge commit uses its own first parent, regardless of later dev changes', () => {
    assert.equal(
        integrationBase('test/repo', id('c'), executor({ parents: { [id('c')]: [id('b'), id('a')] } })),
        id('b')
    )
})
test('squash merge remains one parent when original patches do not match', () => {
    assert.equal(
        integrationBase(
            'test/repo',
            id('c'),
            executor({ parents: { [id('c')]: [id('b')] }, original: [id('d'), id('e')] })
        ),
        id('b')
    )
})
test('rebase merge compares the whole integrated sequence, even with rewritten SHAs', () => {
    assert.equal(
        integrationBase(
            'test/repo',
            id('c'),
            executor({
                parents: { [id('c')]: [id('b')], [id('b')]: [id('a')] },
                original: [id('d'), id('e')],
                patches: { [id('c')]: 'second', [id('e')]: 'second', [id('b')]: 'first', [id('d')]: 'first' },
            })
        ),
        id('a')
    )
})
