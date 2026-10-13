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
        before: {
            inventory: [{ route: '/home', status: 'catalogued', screens: ['home'] }],
            complete: false,
            screens: [
                { id: 'home', kind: 'route', status: 'captured' },
                {
                    id: 'new-component',
                    kind: 'component',
                    status: 'unavailable',
                    reason: 'This revision has no compatible scenario harness for this component; no newer product code was copied',
                },
            ],
        },
        after: { complete: true },
        screens: [
            { id: 'home', status: 'unchanged' },
            { id: 'new-component', status: 'new' },
        ],
    }
    assert.equal(reviewableComparison(comparison), true)
    assert.equal(reviewableComparison({ ...comparison, after: { complete: false } }), false)
    for (const status of ['failed', 'unavailable'])
        assert.equal(reviewableComparison({ ...comparison, screens: [{ status }] }), false)
})

test('a missing baseline route is never reviewable, regardless of current capture or exception', () => {
    const baselineWithMissingRoute = {
        inventory: [
            { route: '/home', status: 'catalogued', screens: ['home'] },
            { route: '/claim-bank', status: 'missing', reason: 'No baseline scenario' },
        ],
        complete: false,
        screens: [
            { id: 'home', kind: 'route', status: 'captured' },
            {
                id: 'new-component',
                kind: 'component',
                status: 'unavailable',
                reason: 'This revision has no compatible scenario harness for this component; no newer product code was copied',
            },
        ],
    }

    for (const screens of [
        [{ id: 'home', status: 'unchanged' }],
        [
            { id: 'home', status: 'unchanged' },
            { id: 'new-component', status: 'new' },
        ],
    ]) {
        for (const exception of ['', 'Screen Library exception: route is intentionally not captured']) {
            assert.equal(
                reviewableComparison({
                    before: baselineWithMissingRoute,
                    after: { complete: true },
                    screens,
                    exception,
                }),
                false,
                `missing route must reject screens=${JSON.stringify(screens)} exception=${JSON.stringify(exception)}`
            )
        }
    }
})

test('only newly registered component harness gaps may be absent from an otherwise complete baseline', () => {
    const comparison = {
        before: {
            complete: false,
            inventory: [{ route: '/home', status: 'catalogued', screens: ['home'] }],
            screens: [
                { id: 'home', kind: 'route', status: 'captured' },
                {
                    id: 'claim-bank-provider',
                    kind: 'component',
                    status: 'unavailable',
                    reason: 'This revision has no compatible scenario harness for this component; no newer product code was copied',
                },
            ],
        },
        after: { complete: true },
        screens: [
            { id: 'home', status: 'unchanged' },
            { id: 'claim-bank-provider', status: 'new' },
        ],
    }

    assert.equal(reviewableComparison(comparison), true)
    assert.equal(reviewableComparison({ ...comparison, after: { complete: false } }), false)
    assert.equal(
        reviewableComparison({
            ...comparison,
            screens: [
                { id: 'home', status: 'unchanged' },
                { id: 'claim-bank-provider', status: 'failed' },
            ],
        }),
        false
    )
    assert.equal(
        reviewableComparison({
            ...comparison,
            screens: [
                { id: 'home', status: 'unchanged' },
                { id: 'claim-bank-provider', status: 'unavailable' },
            ],
        }),
        false
    )
})

const baselineGap = (screen, comparisonStatus = 'unchanged') => ({
    before: {
        complete: false,
        inventory: [{ route: '/home', status: 'catalogued', screens: ['home'] }],
        screens: [{ id: 'home', kind: 'route', status: 'captured' }, screen],
    },
    after: { complete: true },
    screens: [
        { id: 'home', status: 'unchanged' },
        { id: screen.id, status: comparisonStatus },
    ],
})

test('an unavailable baseline route is not a newly registered component harness', () => {
    assert.equal(
        reviewableComparison(
            baselineGap({
                id: 'claim-bank-route',
                kind: 'route',
                status: 'unavailable',
                reason: 'Baseline capture failed',
            })
        ),
        false
    )
})

test('an unrelated unavailable component does not become reviewable after a successful new capture', () => {
    assert.equal(
        reviewableComparison(
            baselineGap(
                {
                    id: 'existing-provider',
                    kind: 'component',
                    status: 'unavailable',
                    reason: 'Existing component baseline capture failed for an unrelated timeout',
                },
                'new'
            )
        ),
        false
    )
})
