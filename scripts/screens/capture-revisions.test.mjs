import test from 'node:test'
import assert from 'node:assert/strict'
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
    const calls = []
    const refs = mainRevisions({ event: 'workflow_dispatch', head: sha('c') }, (args) => {
        calls.push(args)
        return args[0] === 'rev-parse' ? sha('b') + '\n' : ''
    })
    assert.deepEqual(refs, { before: sha('b'), after: sha('c') })
    assert.deepEqual(calls, [
        ['merge-base', '--is-ancestor', sha('c'), sha('c')],
        ['rev-parse', `${sha('c')}^1`],
        ['merge-base', '--is-ancestor', sha('b'), sha('c')],
    ])
})

test('manual release backfill validates both revisions against the immutable main run head', () => {
    const calls = []
    assert.deepEqual(
        mainRevisions({ event: 'workflow_dispatch', head: sha('d'), before: sha('a'), after: sha('c') }, (args) => {
            calls.push(args)
            return ''
        }),
        { before: sha('a'), after: sha('c') }
    )
    assert.deepEqual(calls, [
        ['merge-base', '--is-ancestor', sha('c'), sha('d')],
        ['merge-base', '--is-ancestor', sha('a'), sha('c')],
    ])
    for (const invalidCall of [0, 1]) {
        let call = 0
        assert.throws(
            () =>
                mainRevisions({ event: 'workflow_dispatch', head: sha('d'), before: sha('a'), after: sha('c') }, () => {
                    if (call++ === invalidCall) throw new Error('Not a released main ancestor')
                    return ''
                }),
            /ancestor/
        )
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
