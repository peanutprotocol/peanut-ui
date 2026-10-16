import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateZeroDifferenceGate } from './zero-difference-gate.mjs'

const locales = ['en', 'es-419', 'es-AR', 'pt-BR']
const reports = (changedScreens = 0) => locales.map((locale) => ({ locale, complete: true, changedScreens }))

const evaluate = (overrides = {}) =>
    evaluateZeroDifferenceGate({
        event: 'pull_request',
        changedFiles: ['src/components/TransferReview.tsx'],
        reports: reports(0),
        exception: '',
        ...overrides,
    })

test('complete all-zero UI pull request fails with an actionable reason', () => {
    const result = evaluate()
    assert.equal(result.ok, false)
    assert.equal(typeof result.reason, 'string')
    assert.ok(result.reason.trim().length > 0)
})

test('any genuine visual difference passes', () => {
    for (const changedScreens of [1, 2, 25]) {
        const result = evaluate({ reports: reports(changedScreens) })
        assert.equal(result.ok, true, result.reason)
        assert.equal(typeof result.reason, 'string')
    }
})

test('a nonempty explicit exception line passes an intentional all-zero UI PR', () => {
    for (const exception of [
        'Screen Library exception: copy-only refactor covered by existing states',
        'Context before\nScreen Library exception: no rendered output changes\nContext after',
    ]) {
        const result = evaluate({ exception })
        assert.equal(result.ok, true, result.reason)
    }
})

test('blank and malformed exception text cannot bypass the gate', () => {
    for (const exception of [
        '',
        '   ',
        'Screen Library exception:',
        'Screen Library exception:   ',
        'screen library exception: reason',
        'Screen Library exception reason',
        'Prefix Screen Library exception: hidden inline reason',
    ]) {
        const result = evaluate({ exception })
        assert.equal(result.ok, false, `unexpected bypass for ${JSON.stringify(exception)}`)
    }
})

test('missing, partial, duplicate, or unsuccessful locale reports fail closed', () => {
    const incompleteSets = [
        [],
        reports(0).slice(0, 3),
        [...reports(0).slice(0, 3), reports(0)[0]],
        reports(0).map((report, index) => (index === 2 ? { ...report, complete: false } : report)),
    ]

    for (const candidate of incompleteSets) {
        const result = evaluate({ reports: candidate })
        assert.equal(result.ok, false, `incomplete reports must fail: ${JSON.stringify(candidate)}`)
        assert.ok(result.reason.trim().length > 0)
    }
})

test('gate applies to supported UI paths and ignores tests and capture harness changes', () => {
    for (const file of [
        'src/components/Card.tsx',
        'src/features/withdraw/review.tsx',
        'src/app/[locale]/page.tsx',
        'src/content/card-copy.ts',
        'src/context/ClaimBankFlowContext.tsx',
        'src/config/AppStateProviders.tsx',
        'src/providers/SessionProvider.tsx',
        'src/store/withdraw.ts',
    ])
        assert.equal(evaluate({ changedFiles: [file] }).ok, false, `${file} must be gated`)

    for (const file of [
        'README.md',
        'scripts/screens/report.mjs',
        'src/components/Card.test.tsx',
        'src/features/withdraw/review.spec.ts',
        'src/context/ClaimBankFlowContext.test.tsx',
        'src/config/AppStateProviders.spec.tsx',
        'src/types/navigation.d.ts',
        'src/dev/screens/catalogue.ts',
    ])
        assert.equal(evaluate({ changedFiles: [file] }).ok, true, `${file} must not trigger the UI gate`)
})

test('all-zero changes in runtime UI context and configuration modules require differences or an exception', () => {
    for (const changedFiles of [
        ['src/context/ClaimBankFlowContext.tsx'],
        ['src/config/AppStateProviders.tsx'],
        ['README.md', 'src/context/ClaimBankFlowContext.tsx', 'src/config/AppStateProviders.tsx'],
    ]) {
        assert.equal(evaluate({ changedFiles }).ok, false, `${changedFiles.join(', ')} must be gated`)
        assert.equal(
            evaluate({
                changedFiles,
                exception: 'Screen Library exception: runtime provider refactor preserves rendered output',
            }).ok,
            true,
            `${changedFiles.join(', ')} must accept a valid exception after triggering the gate`
        )
    }
})

test('push and workflow dispatch runs are integration runs and do not apply the PR exception gate', () => {
    for (const event of ['push', 'workflow_dispatch']) {
        const result = evaluate({ event })
        assert.equal(result.ok, true, result.reason)
    }
})

test('the same input is idempotent and does not mutate caller-owned data', () => {
    const input = {
        event: 'pull_request',
        changedFiles: ['src/app/page.tsx'],
        reports: reports(0),
        exception: '',
    }
    const before = structuredClone(input)
    const first = evaluateZeroDifferenceGate(input)
    const second = evaluateZeroDifferenceGate(input)
    assert.deepEqual(first, second)
    assert.deepEqual(input, before)
})
