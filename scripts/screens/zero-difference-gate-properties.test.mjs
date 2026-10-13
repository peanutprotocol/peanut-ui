import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateZeroDifferenceGate, reviewableComparison } from './zero-difference-gate.mjs'

const locales = ['en', 'es-419', 'es-AR', 'pt-BR']
let seed = 0x36853692
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 0x100000000

test('seeded locale permutations preserve the zero-difference decision', () => {
    for (let iteration = 0; iteration < 512; iteration++) {
        const changedLocale = Math.floor(random() * 4)
        const changedCount = Math.floor(random() * 6)
        const reports = locales.map((locale, index) => ({
            locale,
            complete: true,
            changedScreens: index === changedLocale ? changedCount : 0,
        }))
        reports.sort(() => random() - 0.5)
        const result = evaluateZeroDifferenceGate({
            event: 'pull_request',
            changedFiles: ['src/features/withdraw/views/ConfirmWithdrawView.tsx'],
            reports,
            exception: '',
        })
        assert.equal(result.ok, changedCount > 0, `iteration=${iteration} changed=${changedCount}`)
    }
})

test('malformed comparison counts fail closed under bounded fault inputs', () => {
    for (const changedScreens of [-1, 0.5, NaN, Infinity, '1', null, undefined]) {
        const result = evaluateZeroDifferenceGate({
            event: 'pull_request',
            changedFiles: ['src/content/messages/en.json'],
            reports: locales.map((locale) => ({ locale, complete: true, changedScreens })),
            exception: 'Screen Library exception: intentional nonvisual change',
        })
        assert.equal(result.ok, false, `invalid count ${String(changedScreens)} must not pass`)
    }
})

test('an unfilled PR template placeholder is not an exception reason', () => {
    for (const exception of [
        'Screen Library exception: <reason>',
        'Screen Library exception: TODO',
        'Screen Library exception: TBD',
    ]) {
        assert.equal(
            evaluateZeroDifferenceGate({
                event: 'pull_request',
                changedFiles: ['src/content/messages/en.json'],
                reports: locales.map((locale) => ({ locale, complete: true, changedScreens: 0 })),
                exception,
            }).ok,
            false
        )
    }
})

test('bounded changed-file workload remains deterministic', () => {
    const changedFiles = Array.from({ length: 2000 }, (_, index) => `docs/change-${index}.md`)
    changedFiles.push('src/components/Card/ApplicationStatusScreen.tsx')
    const input = {
        event: 'pull_request',
        changedFiles,
        reports: locales.map((locale) => ({ locale, complete: true, changedScreens: 0 })),
        exception: '',
    }
    assert.equal(evaluateZeroDifferenceGate(input).ok, false)
    assert.equal(evaluateZeroDifferenceGate(input).ok, false)
})

test('translation-only and visual asset changes require coverage', () => {
    for (const path of ['src/i18n/app/messages/en.json', 'src/assets/cards/peanut-card-hand.svg']) {
        assert.equal(
            evaluateZeroDifferenceGate({
                event: 'pull_request',
                changedFiles: [path],
                reports: locales.map((locale) => ({ locale, complete: true, changedScreens: 0 })),
                exception: '',
            }).ok,
            false,
            path
        )
    }
})

test('newly registered states are reviewable but failed captures are not', () => {
    const comparison = {
        before: { inventory: [{ route: '/home', status: 'catalogued' }], complete: false },
        after: { complete: true },
        screens: [{ status: 'unchanged' }, { status: 'new' }],
    }
    assert.equal(reviewableComparison(comparison), true)
    assert.equal(reviewableComparison({ ...comparison, after: { complete: false } }), false)
    for (const status of ['failed', 'unavailable'])
        assert.equal(reviewableComparison({ ...comparison, screens: [{ status }] }), false)
})
