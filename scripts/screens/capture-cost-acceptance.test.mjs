import test from 'node:test'
import assert from 'node:assert/strict'

// Frozen spec-only acceptance tests. Breadth seed: 0x51c0ffee.
// Workload: 64 graph/permutation cases, each with 4 flows and up to 8 modules.
const load = async (file, name) => (await import(file))[name]
const copy = (value) => structuredClone(value)
const ids = (value) => [...value].sort()
const locales = ['en', 'es-419', 'es-AR', 'pt-BR']
const screens = [
    { id: 'pay-review', flow: 'Payments', sources: ['src/features/payments/Review.tsx'] },
    { id: 'pay-success', flow: 'Payments', sources: ['src/features/payments/Success.tsx'] },
    { id: 'home', flow: 'Home', sources: ['src/features/home/Home.tsx'] },
]
const dependencies = {
    'src/features/payments/Review.tsx': ['src/features/payments/format.ts'],
    'src/features/payments/Success.tsx': [],
    'src/features/payments/format.ts': [],
    'src/features/home/Home.tsx': [],
}
const input = (changedFiles, extra = {}) => ({
    event: 'pull_request',
    branch: 'dev',
    changedFiles,
    screens: copy(screens),
    dependencies: copy(dependencies),
    ...extra,
})
const assertPlan = (plan, mode, expectedIds) => {
    assert.equal(plan.mode, mode)
    assert.deepEqual(ids(plan.screenIds), ids(expectedIds))
    assert.equal(new Set(plan.screenIds).size, plan.screenIds.length)
    assert.ok(Array.isArray(plan.reasons) && plan.reasons.length > 0)
    assert.ok(plan.reasons.every((reason) => typeof reason === 'string' && reason.trim().length > 0))
}
const failClosed = async (planner, candidate) => {
    let plan
    try {
        plan = await planner(candidate)
    } catch {
        return
    }
    assertPlan(
        plan,
        'full',
        (candidate.screens ?? screens).map((screen) => screen.id)
    )
}
const manifest = (extra = {}) => ({
    schema: 1,
    type: 'capture',
    commit: 'a'.repeat(40),
    contentCommit: 'b'.repeat(40),
    harness: 'c'.repeat(64),
    fixtures: 'd'.repeat(64),
    environment: 'linux-test;node22;chromium-test',
    adapter: 'v1',
    capturedAt: '2026-10-14T00:00:00Z',
    publicBase: 'https://staging.peanut.me',
    locale: 'en',
    profile: 'en-393x852',
    width: 393,
    height: 852,
    screens: [
        {
            id: 'pay-review',
            name: 'Pay review',
            flow: 'Payments',
            kind: 'route',
            status: 'captured',
            image: `${'e'.repeat(64)}.png`,
            thumbnail: `${'f'.repeat(64)}.webp`,
        },
    ],
    inventory: [{ route: '/send', status: 'catalogued', screens: ['pay-review'] }],
    adapterFiles: [],
    ...extra,
})
const targetedPlan = { mode: 'targeted', screenIds: ['pay-review', 'pay-success'] }
const fullReports = () => locales.map((locale) => ({ locale, complete: true, changedScreens: 1 }))
const scopedReports = () =>
    locales.map((locale) => ({
        locale,
        complete: false,
        scopeComplete: true,
        scope: copy(targetedPlan),
        changedScreens: 1,
    }))
const gateInput = (reports, extra = {}) => ({
    event: 'pull_request',
    changedFiles: ['src/features/payments/format.ts'],
    reports,
    ...extra,
})
// Established public gate result contract, clarified before implementation.
const passed = (result) => {
    assert.equal(typeof result.ok, 'boolean')
    assert.equal(typeof result.reason, 'string')
    assert.ok(result.reason.trim().length > 0)
    return result.ok
}

test('planner skips the declared known nonvisual changes', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    const paths = [
        'README.md',
        'docs/design.md',
        '.github/workflows/release-native.yml',
        'src/components/Card.test.tsx',
        'src/components/__tests__/Card.test.tsx',
        'e2e/login.spec.ts',
        'public/screen-library/viewer.js',
        'public/screen-library/viewer.css',
    ]
    for (const path of paths) assertPlan(plan(input([path])), 'skip', [])
    assertPlan(plan(input(paths)), 'skip', [])
})

test('planner targets every state of a transitively affected flow', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    const candidate = input(['README.md', 'src/features/payments/format.ts'])
    const original = copy(candidate)
    assertPlan(plan(candidate), 'targeted', ['pay-review', 'pay-success'])
    assert.deepEqual(candidate, original)
})

test('planner forces full capture for globals, unknown paths and capture infrastructure', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    for (const path of [
        'src/context/authContext.tsx',
        'src/hooks/useNotifications.ts',
        'src/services/push.ts',
        'src/i18n/app/locales/en.json',
        'public/logo.svg',
        'pnpm-lock.yaml',
        'next.config.js',
        '.github/workflows/screen-library.yml',
        'scripts/screens/capture.ts',
        'src/dev/fixtures/registry.ts',
        'some-new-config.json',
    ]) {
        const candidate = input([path])
        // A misleading graph must not downgrade globally affecting changes.
        candidate.dependencies['src/features/payments/Review.tsx'].push(path)
        candidate.dependencies[path] = []
        assert.notEqual(plan(candidate).mode, 'skip', path)
        if (
            [
                'src/i18n/app/locales/en.json',
                'public/logo.svg',
                'pnpm-lock.yaml',
                'next.config.js',
                '.github/workflows/screen-library.yml',
                'scripts/screens/capture.ts',
                'src/dev/fixtures/registry.ts',
                'some-new-config.json',
            ].includes(path)
        )
            assertPlan(
                plan(candidate),
                'full',
                screens.map((screen) => screen.id)
            )
    }
})

test('manual capture overrides nonvisual skip; visual dev/main pushes are full', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    assertPlan(
        plan(input(['README.md'], { event: 'workflow_dispatch' })),
        'full',
        screens.map((screen) => screen.id)
    )
    for (const branch of ['dev', 'main']) {
        assertPlan(
            plan(input(['src/features/payments/format.ts'], { event: 'push', branch })),
            'full',
            screens.map((screen) => screen.id)
        )
        const nonvisual = plan(input(['README.md'], { event: 'push', branch }))
        assert.ok(['full', 'skip'].includes(nonvisual.mode))
    }
})

test('all affected flows become full; both paths of rename/delete affect planning', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    assertPlan(
        plan(input(['src/features/payments/format.ts', 'src/features/home/Home.tsx'])),
        'full',
        screens.map((screen) => screen.id)
    )
    await failClosed(plan, input(['src/features/payments/format.ts', 'src/features/new/format.ts']))
})

test('missing graphs and unknown traversed modules fail closed', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    for (const broken of [undefined, null, {}])
        await failClosed(plan, input(['src/features/payments/format.ts'], { dependencies: broken }))
    for (const entry of [undefined, null]) {
        const candidate = input(['src/features/payments/format.ts'])
        candidate.dependencies['src/features/payments/format.ts'] = entry
        await failClosed(plan, candidate)
    }
})

test('invalid changed paths and incomplete inputs never skip or target', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    for (const paths of [
        undefined,
        null,
        [null],
        [''],
        ['../README.md'],
        ['/README.md'],
        ['SRC/features/payments/format.ts'],
        ['src/features/new/Unknown.tsx'],
    ])
        await failClosed(plan, input(paths))
})

test('planner graph cycles and seeded permutations are bounded and deterministic', async () => {
    const plan = await load('./capture-plan.mjs', 'planCapture')
    let seed = 0x51c0ffee
    const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        return seed / 2 ** 32
    }
    const shuffle = (values) => {
        const result = [...values]
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1))
            ;[result[i], result[j]] = [result[j], result[i]]
        }
        return result
    }
    for (let iteration = 0; iteration < 64; iteration++) {
        const graph = {}
        const registered = []
        for (let flow = 0; flow < 4; flow++) {
            const root = `src/features/flow${flow}/Root.tsx`
            const leaf = `src/features/flow${flow}/value.ts`
            registered.push(
                { id: `f${flow}-a`, flow: `Flow ${flow}`, sources: [root] },
                { id: `f${flow}-b`, flow: `Flow ${flow}`, sources: [root] }
            )
            graph[root] = [leaf]
            graph[leaf] = [root]
        }
        const selected = Math.floor(random() * 4)
        const changed = `src/features/flow${selected}/value.ts`
        const base = input([changed, 'README.md'], { screens: registered, dependencies: graph })
        const permuted = copy(base)
        permuted.changedFiles = shuffle([changed, 'README.md', changed])
        permuted.screens = shuffle(permuted.screens)
        for (const key of Object.keys(graph)) permuted.dependencies[key] = shuffle([...graph[key], ...graph[key]])
        const before = copy(permuted)
        const expected = plan(base)
        const actual = plan(permuted)
        assertPlan(actual, 'targeted', [`f${selected}-a`, `f${selected}-b`])
        assert.equal(actual.mode, expected.mode)
        assert.deepEqual(actual.screenIds, expected.screenIds)
        assert.deepEqual(permuted, before)
    }
})

test('baseline accepts a complete compatible legacy manifest without mutation', async () => {
    const reuse = await load('./baseline-reuse.mjs', 'canReuseBaseline')
    const before = manifest()
    const after = manifest({ commit: '9'.repeat(40) })
    const saved = copy([before, after])
    assert.equal(reuse(before, after, before.commit), true)
    assert.deepEqual([before, after], saved)
    assert.equal(reuse(before, after, '0'.repeat(40)), false)
})

test('baseline rejects every mismatched capture identity', async () => {
    const reuse = await load('./baseline-reuse.mjs', 'canReuseBaseline')
    const before = manifest()
    for (const [key, value] of Object.entries({
        locale: 'pt-BR',
        profile: 'other',
        width: 400,
        height: 900,
        publicBase: 'https://other.example',
        harness: '1'.repeat(64),
        fixtures: '2'.repeat(64),
        environment: 'other',
        adapter: 'v2',
        device: 'other',
    }))
        assert.equal(reuse(before, manifest({ [key]: value }), before.commit), false, key)
})

test('baseline rejects corrupt, incomplete and caller-certified manifests', async () => {
    const reuse = await load('./baseline-reuse.mjs', 'canReuseBaseline')
    const before = manifest()
    for (const bad of [
        null,
        {},
        manifest({ screens: [] }),
        manifest({ screens: [{ ...before.screens[0], status: 'failed' }], complete: true }),
        manifest({ inventory: [{ route: '/missing', status: 'missing', screens: [] }], complete: true }),
        manifest({ harness: undefined }),
        manifest({ commit: undefined }),
    ])
        assert.equal(reuse(bad, manifest(), before.commit), false)
})

test('baseline permits selected after coverage but rejects scoped before and uncovered states', async () => {
    const reuse = await load('./baseline-reuse.mjs', 'canReuseBaseline')
    const before = manifest()
    const after = manifest({
        scope: { mode: 'targeted', screenIds: ['pay-review'] },
        complete: false,
        scopeComplete: true,
    })
    assert.equal(reuse(before, after, before.commit), true)
    assert.equal(reuse(after, manifest(), before.commit), false)
    const missing = manifest({
        screens: [{ ...before.screens[0], id: 'new-screen' }],
        scope: { mode: 'targeted', screenIds: ['new-screen'] },
    })
    assert.equal(reuse(before, missing, before.commit), false)
})

test('scoping projects inventory and preserves identities without mutating capture', async () => {
    const scope = await load('./capture-scope.mjs', 'scopeCapture')
    const source = manifest()
    source.screens.push({ ...source.screens[0], id: 'home', flow: 'Home' })
    source.inventory.push(
        { route: '/home', status: 'catalogued', screens: ['home'] },
        { route: '/unrelated', status: 'missing', screens: [] }
    )
    const saved = copy(source)
    const result = scope(source, { mode: 'targeted', screenIds: ['pay-review'] })
    assert.deepEqual(
        result.screens.map((screen) => screen.id),
        ['pay-review']
    )
    assert.deepEqual(result.scope, { mode: 'targeted', screenIds: ['pay-review'] })
    assert.equal(result.complete, false)
    assert.equal(result.scopeComplete, true)
    assert.deepEqual(result.inventory, [source.inventory[0]])
    for (const key of ['commit', 'contentCommit', 'harness', 'fixtures', 'environment'])
        assert.equal(result[key], source[key])
    assert.deepEqual(source, saved)
    assert.notEqual(result, source)
})

test('scoping rejects empty, duplicate and unknown selected IDs', async () => {
    const scope = await load('./capture-scope.mjs', 'scopeCapture')
    for (const screenIds of [[], ['pay-review', 'pay-review'], ['unknown']])
        assert.throws(() => scope(manifest(), { mode: 'targeted', screenIds }))
})

test('scope completeness requires a capture and all states settled', async () => {
    const scope = await load('./capture-scope.mjs', 'scopeCapture')
    for (const status of ['captured', 'excluded', 'absent', 'failed', 'unavailable', 'missing']) {
        const source = manifest()
        source.screens.push({ ...source.screens[0], id: 'pay-success', status })
        const result = scope(source, targetedPlan)
        assert.equal(result.scopeComplete, ['captured', 'excluded', 'absent'].includes(status), status)
        assert.equal(result.complete, false)
    }
    const excluded = manifest()
    excluded.screens[0].status = 'excluded'
    assert.equal(scope(excluded, { mode: 'targeted', screenIds: ['pay-review'] }).scopeComplete, false)
})

test('scope survives validation and canonicalizes selected ID order', async () => {
    const scope = await load('./capture-scope.mjs', 'scopeCapture')
    const validate = await load('./core.mjs', 'validateCapture')
    const source = manifest()
    source.screens.push({ ...source.screens[0], id: 'pay-success' })
    const first = scope(source, targetedPlan)
    const second = scope(source, { mode: 'targeted', screenIds: [...targetedPlan.screenIds].reverse() })
    assert.deepEqual(first.scope, second.scope)
    const validated = validate(first)
    assert.deepEqual(validated.scope, first.scope)
    assert.equal(validated.complete, false)
    assert.equal(validated.scopeComplete, true)
})

test('legacy full gate retains full coverage and difference behavior', async () => {
    const gate = await load('./zero-difference-gate.mjs', 'evaluateZeroDifferenceGate')
    assert.equal(passed(gate(gateInput(fullReports()))), true)
    const zero = fullReports().map((report) => ({ ...report, changedScreens: 0 }))
    assert.equal(passed(gate(gateInput(zero))), false)
    assert.equal(
        passed(gate(gateInput(zero, { exception: 'Screen Library exception: deliberate invisible runtime fix' }))),
        true
    )
})

test('trusted targeted gate accepts order-independent exact scopes without mutation', async () => {
    const gate = await load('./zero-difference-gate.mjs', 'evaluateZeroDifferenceGate')
    const reports = scopedReports().reverse()
    reports[0].scope.screenIds.reverse()
    const candidate = gateInput(reports, { plan: copy(targetedPlan) })
    const saved = copy(candidate)
    assert.equal(passed(gate(candidate)), true)
    assert.deepEqual(candidate, saved)
})

test('targeted zero difference requires a nonempty existing exception line', async () => {
    const gate = await load('./zero-difference-gate.mjs', 'evaluateZeroDifferenceGate')
    const reports = scopedReports().map((report) => ({ ...report, changedScreens: 0 }))
    for (const exception of [undefined, '', 'Screen Library exception: '])
        assert.equal(passed(gate(gateInput(reports, { plan: targetedPlan, exception }))), false)
    assert.equal(
        passed(
            gate(
                gateInput(reports, {
                    plan: targetedPlan,
                    exception: 'Screen Library exception: deliberate invisible runtime fix',
                })
            )
        ),
        true
    )
})

test('scoped artifacts alone and full plans cannot authorize scoped reports', async () => {
    const gate = await load('./zero-difference-gate.mjs', 'evaluateZeroDifferenceGate')
    assert.equal(passed(gate(gateInput(scopedReports()))), false)
    assert.equal(
        passed(gate(gateInput(scopedReports(), { plan: { mode: 'full', screenIds: targetedPlan.screenIds } }))),
        false
    )
})

test('targeted gate rejects absent, mismatched, duplicate or unsettled locale scopes', async () => {
    const gate = await load('./zero-difference-gate.mjs', 'evaluateZeroDifferenceGate')
    const mutations = [
        (reports) => reports.pop(),
        (reports) => {
            reports[0].locale = reports[1].locale
        },
        (reports) => {
            reports[0].locale = 'unknown'
        },
        (reports) => {
            delete reports[0].scope
        },
        (reports) => {
            reports[0].scope.screenIds = ['pay-review']
        },
        (reports) => {
            reports[0].scope.screenIds.push('extra')
        },
        (reports) => {
            reports[0].scope.screenIds.push('pay-review')
        },
        (reports) => {
            reports[0].scopeComplete = false
        },
        (reports) => {
            reports[0].changedScreens = -1
        },
        (reports) => {
            reports[0].changedScreens = 0.5
        },
        (reports) => {
            delete reports[0].changedScreens
        },
    ]
    for (const mutate of mutations) {
        const reports = scopedReports()
        mutate(reports)
        assert.equal(
            passed(
                gate(
                    gateInput(reports, {
                        plan: targetedPlan,
                        exception: 'Screen Library exception: allowed difference exception',
                    })
                )
            ),
            false
        )
    }
})
