import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mainRevisions, pushRevisions } from './capture-revisions.mjs'

const sha = (letter) => letter.repeat(40)
test('dev and main pushes compare the whole push boundary, not only the newest commit or a PR baseline', () => {
    const before = sha('a'),
        head = sha('c')
    assert.deepEqual(
        mainRevisions({ event: 'push', before, head, after: sha('d') }, () => {
            throw new Error('A push must not resolve mutable refs or substitute a first parent')
        }),
        { before, after: head }
    )
    assert.deepEqual(pushRevisions({ before, head }), { before, after: head })
})

test('main push rejects missing or malformed previous revisions', () => {
    for (const before of [undefined, '', 'main', sha('0'), 'a'.repeat(39), 'a'.repeat(40) + ';echo unsafe'])
        assert.throws(() => pushRevisions({ before, head: sha('c') }), /previous branch revision/)
})

test('manual main capture defaults to the selected revision and its first parent', () => {
    assert.deepEqual(
        mainRevisions({ event: 'workflow_dispatch', head: sha('c') }, () => [sha('c'), sha('b'), sha('a')].join('\n')),
        { before: sha('b'), after: sha('c') }
    )
})

test('manual release backfill accepts earlier main intervals and rejects missing, equal, or reversed revisions', () => {
    const history = () => [sha('d'), sha('c'), sha('b'), sha('a')].join('\n')
    assert.deepEqual(
        mainRevisions({ event: 'workflow_dispatch', head: sha('d'), before: sha('a'), after: sha('c') }, history),
        { before: sha('a'), after: sha('c') }
    )
    for (const selected of [
        { after: sha('e') },
        { before: sha('e'), after: sha('c') },
        { before: sha('c'), after: sha('c') },
        { before: sha('d'), after: sha('c') },
    ])
        assert.throws(
            () => mainRevisions({ event: 'workflow_dispatch', head: sha('d'), ...selected }, history),
            /first-parent/
        )
    assert.throws(
        () => mainRevisions({ event: 'workflow_dispatch', head: sha('d'), after: sha('a') }, history),
        /previous main revision/
    )
})

test('merged dev ancestors cannot be published as Main releases in a real merge graph', () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-main-history-test-'))
    const git = (args, input) => execFileSync('git', args, { cwd: dir, input, encoding: 'utf8' }).trim()
    try {
        git(['init', '--bare', '--quiet'])
        const tree = git(['mktree'], '')
        const commit = (name, parents = []) =>
            git(
                [
                    '-c',
                    'user.name=Screen library tests',
                    '-c',
                    'user.email=screen-tests@example.invalid',
                    '-c',
                    'commit.gpgsign=false',
                    'commit-tree',
                    tree,
                    ...parents.flatMap((parent) => ['-p', parent]),
                ],
                name + '\n'
            )
        const root = commit('root')
        const previousMain = commit('previous main', [root])
        const devParent = commit('dev parent', [root])
        const devHead = commit('dev head', [devParent])
        const release = commit('merge dev into main', [previousMain, devHead])
        const runHead = commit('later main update', [release])
        // This is exactly why ordinary ancestry checks did not enforce the release line.
        git(['merge-base', '--is-ancestor', devHead, release])
        const resolve = (selected) => mainRevisions({ event: 'workflow_dispatch', head: runHead, ...selected }, git)
        assert.throws(() => resolve({ after: devHead }), /After.*first-parent/)
        assert.throws(() => resolve({ before: devParent, after: release }), /Before.*first-parent/)
        assert.throws(() => resolve({ before: devHead, after: release }), /Before.*first-parent/)
        assert.deepEqual(resolve({ after: release }), { before: previousMain, after: release })
        assert.deepEqual(resolve({ before: root, after: release }), { before: root, after: release })
        assert.deepEqual(resolve({}), { before: release, after: runHead })
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})

test('manual captures reject mutable or injectable inputs before invoking git', () => {
    for (const inputs of [{ head: 'main' }, { after: 'dev' }, { before: '--help' }, { event: 'pull_request' }])
        assert.throws(
            () =>
                mainRevisions({ event: 'workflow_dispatch', head: sha('c'), ...inputs }, () =>
                    assert.fail('Invalid input reached git')
                ),
            /Invalid|immutable|Unsupported/
        )
})
