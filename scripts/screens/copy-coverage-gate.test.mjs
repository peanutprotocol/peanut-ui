import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { evaluateCopyGate, parseCopyBaseline } from './copy-coverage.mjs'
import { nextBaseline } from './copy-coverage-baseline.mjs'
import { prepare } from './prepare.mjs'

const EXCEPTION = 'Screen Library copy exception: reviewed by design'
const BASE_TEXT = { 'a.one': 'Alpha one', 'a.two': 'Beta two' }

const plainJson = (value) => JSON.parse(JSON.stringify(value))
const texts = (entries) => new Map(Object.entries(entries))
const state = (shown, extra = {}) => ({
    copyRecording: 'recorded',
    complete: true,
    screens: [{ id: 's1', status: 'captured', copy: shown }],
    ...extra,
})
const SCOPE = { screens: ['s1'] }

const enGate = ({
    beforeText = BASE_TEXT,
    afterText = BASE_TEXT,
    beforeShown = ['a.one', 'a.two'],
    afterShown = ['a.one', 'a.two'],
    beforeState = {},
    afterState = {},
    baselineBefore = {},
    baselineAfter = {},
    ...overrides
} = {}) => ({
    event: 'pull_request',
    supported: true,
    reports: [
        {
            locale: 'en',
            before: state(beforeShown, beforeState),
            after: state(afterShown, afterState),
        },
    ],
    catalogues: { en: { before: texts(beforeText), after: texts(afterText) } },
    baseline: {
        before: baselineBefore === null ? null : texts(baselineBefore),
        after: texts(baselineAfter),
    },
    exception: false,
    ...overrides,
})

const evaluate = (input) => evaluateCopyGate(input)

test('events other than pull_request pass without looking at the inputs', () => {
    for (const event of ['push', 'workflow_dispatch', 'merge_group', 'schedule']) {
        const result = evaluate({
            event,
            supported: true,
            reports: [],
            catalogues: {},
            baseline: null,
            exception: false,
        })
        assert.equal(result.ok, true, event)
    }
})

test('a harness that predates recording passes', () => {
    const result = evaluate({
        event: 'pull_request',
        supported: false,
        reports: [],
        catalogues: {},
        baseline: null,
        exception: false,
    })
    assert.equal(result.ok, true)
})

test('missing reports or baseline fail closed', () => {
    const cases = [
        ['undefined reports', { reports: undefined }],
        ['null reports', { reports: null }],
        ['empty reports', { reports: [] }],
        ['undefined baseline', { baseline: undefined }],
        ['null baseline', { baseline: null }],
        ['empty baseline object', { baseline: {} }],
        ['baseline without after', { baseline: { before: new Map() } }],
        ['baseline with null after', { baseline: { before: new Map(), after: null } }],
    ]
    for (const [name, overrides] of cases) {
        const result = evaluate(enGate(overrides))
        assert.equal(result.ok, false, name)
        assert.equal(typeof result.reason, 'string', name)
        assert.ok(result.reason.trim().length > 0, name)
    }
})

test('an after-state that did not record copy fails and names the locale', () => {
    for (const locale of ['es-419', 'es-AR', 'pt-BR'])
        for (const copyRecording of ['unsupported', 'none', undefined]) {
            const input = enGate()
            input.reports.push({
                locale,
                before: state(['a.one', 'a.two']),
                after: state(['a.one', 'a.two'], { copyRecording }),
            })
            input.catalogues[locale] = { before: texts(BASE_TEXT), after: texts(BASE_TEXT) }
            const result = evaluate(input)
            assert.equal(result.ok, false, `${locale} ${String(copyRecording)}`)
            assert.match(result.reason, new RegExp(locale), `${locale} ${String(copyRecording)}`)
        }
    const english = evaluate(enGate({ afterState: { copyRecording: 'unsupported' } }))
    assert.equal(english.ok, false)
})

test('runs that satisfy every rule pass with empty findings', () => {
    const cases = [
        ['unchanged and fully shown', enGate()],
        ['scoped, nothing missing', enGate({ afterState: { scope: SCOPE } })],
        [
            'accepted never-shown key listed in the baseline',
            enGate({
                afterShown: ['a.one'],
                baselineBefore: { 'a.two': 'decorative' },
                baselineAfter: { 'a.two': 'decorative' },
            }),
        ],
        ['no baseline before', enGate({ baselineBefore: null })],
    ]
    for (const [name, input] of cases) {
        const result = evaluate(input)
        assert.equal(result.ok, true, `${name}: ${result.reason}`)
        for (const field of ['unshownChanged', 'newGaps', 'stale', 'grown', 'lost'])
            assert.deepEqual(result[field], [], `${name}: ${field}`)
    }
})

// rule A: changed copy must be visible in some captured after-state
test('changed copy that no captured after-state shows is reported, and an exception line waives it', () => {
    const withNew = { ...BASE_TEXT, 'a.new': 'Brand new' }
    const withEdit = { ...BASE_TEXT, 'a.two': 'Beta two edited' }
    const cases = [
        {
            name: 'new key not shown',
            afterText: withNew,
            afterShown: ['a.one'],
            expected: ['a.new'],
        },
        {
            name: 'edited key not shown',
            afterText: withEdit,
            beforeShown: ['a.one'],
            afterShown: ['a.one'],
            expected: ['a.two'],
        },
        {
            name: 'several keys come back sorted',
            beforeText: BASE_TEXT,
            afterText: { ...BASE_TEXT, 'a.zz': 'Zed', 'a.bb': 'Bee' },
            beforeShown: ['a.one'],
            afterShown: ['a.one'],
            expected: ['a.bb', 'a.zz'],
        },
    ]
    const modes = {
        scoped: { afterState: { scope: SCOPE } },
        'unscoped and incomplete': { afterState: { complete: false } },
    }
    for (const { name, expected, ...scenario } of cases)
        for (const [mode, modeOptions] of Object.entries(modes)) {
            const label = `${name} (${mode})`
            const failing = evaluate(
                enGate({ beforeShown: ['a.one'], afterShown: ['a.one'], ...scenario, ...modeOptions })
            )
            assert.equal(failing.ok, false, label)
            assert.deepEqual(failing.unshownChanged, expected, label)
            const waived = evaluate(
                enGate({
                    beforeShown: ['a.one'],
                    afterShown: ['a.one'],
                    ...scenario,
                    ...modeOptions,
                    exception: EXCEPTION,
                })
            )
            assert.equal(waived.ok, true, `${label}: ${waived.reason}`)
        }
})

test('changed copy that is shown, unchanged, or deleted is not reported', () => {
    const cases = [
        {
            name: 'new key shown',
            afterText: { ...BASE_TEXT, 'a.new': 'Brand new' },
            afterShown: ['a.one', 'a.two', 'a.new'],
        },
        { name: 'edited key shown', afterText: { ...BASE_TEXT, 'a.two': 'Beta two edited' } },
        { name: 'deleted key', afterText: { 'a.one': 'Alpha one' }, afterShown: ['a.one'] },
        {
            name: 'unchanged never-shown key',
            beforeText: { ...BASE_TEXT, 'a.hidden': 'Hidden' },
            afterText: { ...BASE_TEXT, 'a.hidden': 'Hidden' },
            beforeShown: ['a.one', 'a.two'],
            afterShown: ['a.one', 'a.two'],
            afterState: { scope: SCOPE },
        },
    ]
    for (const { name, ...scenario } of cases) {
        const result = evaluate(enGate({ afterState: { scope: SCOPE }, ...scenario }))
        assert.equal(result.ok, true, `${name}: ${result.reason}`)
        assert.deepEqual(result.unshownChanged, [], name)
    }
})

test('only captured screens count as showing changed copy', () => {
    const input = enGate({
        afterText: { ...BASE_TEXT, 'a.new': 'Brand new' },
        afterState: { scope: SCOPE },
    })
    input.reports[0].after.screens.push(
        { id: 's2', status: 'failed', copy: ['a.new'] },
        { id: 's3', status: 'skipped', copy: ['a.new'] }
    )
    const result = evaluate(input)
    assert.equal(result.ok, false)
    assert.deepEqual(result.unshownChanged, ['a.new'])
})

test('changed copy in other locales is reported per locale as "key (locale)"', () => {
    const cases = [
        { locale: 'es-419', shownInLocale: ['a.one', 'a.two'], expected: ['a.new (es-419)'] },
        { locale: 'es-AR', shownInLocale: ['a.one', 'a.two'], expected: ['a.new (es-AR)'] },
        { locale: 'pt-BR', shownInLocale: ['a.one', 'a.two'], expected: ['a.new (pt-BR)'] },
        { locale: 'pt-BR', shownInLocale: ['a.one', 'a.two', 'a.new'], expected: [] },
    ]
    for (const { locale, shownInLocale, expected } of cases) {
        const withNew = { ...BASE_TEXT, 'a.new': 'Brand new' }
        const input = enGate({ afterText: withNew, afterShown: ['a.one', 'a.two', 'a.new'] })
        input.reports.push({
            locale,
            before: state(['a.one', 'a.two']),
            after: state(shownInLocale),
        })
        input.catalogues[locale] = { before: texts(BASE_TEXT), after: texts(withNew) }
        const result = evaluate(input)
        assert.deepEqual(result.unshownChanged, expected, `${locale} ${expected.join()}`)
        assert.equal(result.ok, expected.length === 0, `${locale}: ${result.reason}`)
    }
})

// rule lost: a scoped run must not stop showing copy that earlier states showed
test('scoped runs fail when previously shown copy disappears, unless excepted', () => {
    const TEXT3 = { ...BASE_TEXT, 'a.three': 'Gamma three' }
    const scoped = { afterState: { scope: SCOPE } }
    const cases = [
        {
            name: 'one key lost',
            input: enGate({
                beforeText: TEXT3,
                afterText: TEXT3,
                beforeShown: ['a.one', 'a.two'],
                afterShown: ['a.one'],
                ...scoped,
            }),
            expected: ['a.two'],
        },
        {
            name: 'several keys lost come back sorted',
            input: enGate({
                beforeText: TEXT3,
                afterText: TEXT3,
                beforeShown: ['a.two', 'a.three', 'a.one'],
                afterShown: [],
                ...scoped,
            }),
            expected: ['a.one', 'a.three', 'a.two'],
        },
    ]
    for (const { name, input, expected } of cases) {
        const result = evaluate(input)
        assert.equal(result.ok, false, name)
        assert.deepEqual(result.lost, expected, name)
        assert.match(result.reason, /Add a capture state/, name)
        const waived = evaluate({ ...input, exception: EXCEPTION })
        assert.equal(waived.ok, true, `${name}: ${waived.reason}`)
    }
})

test('copy is not lost when it is accepted, deleted, unrecorded before, or the run is not scoped', () => {
    const base = { beforeShown: ['a.one', 'a.two'], afterShown: ['a.one'] }
    const cases = [
        {
            name: 'listed in the baseline',
            input: enGate({
                ...base,
                afterState: { scope: SCOPE },
                baselineBefore: null,
                baselineAfter: { 'a.two': 'decorative' },
            }),
        },
        {
            name: 'deleted from the catalogue',
            input: enGate({ ...base, afterText: { 'a.one': 'Alpha one' }, afterState: { scope: SCOPE } }),
        },
        {
            name: 'before state did not record copy',
            input: enGate({ ...base, beforeState: { copyRecording: 'unsupported' }, afterState: { scope: SCOPE } }),
        },
        {
            name: 'before state has no copy recording field',
            input: enGate({ ...base, beforeState: { copyRecording: undefined }, afterState: { scope: SCOPE } }),
        },
        {
            name: 'unscoped and incomplete',
            input: enGate({ ...base, afterState: { complete: false } }),
        },
    ]
    for (const { name, input } of cases) {
        const result = evaluate(input)
        assert.equal(result.ok, true, `${name}: ${result.reason}`)
        assert.deepEqual(result.lost, [], name)
    }
})

// rule baseline: the never-shown list must match reality exactly
test('stale baseline entries always fail, even with an exception line', () => {
    const cases = [
        {
            name: 'listed key is now shown',
            input: enGate({ baselineBefore: null, baselineAfter: { 'a.two': 'decorative' } }),
            expected: ['a.two'],
        },
        {
            name: 'listed key left the catalogue',
            input: enGate({
                afterText: { 'a.one': 'Alpha one' },
                afterShown: ['a.one'],
                baselineBefore: null,
                baselineAfter: { 'a.gone': 'removed copy' },
            }),
            expected: ['a.gone'],
        },
        {
            name: 'stale while the run is incomplete',
            input: enGate({
                afterState: { complete: false },
                baselineBefore: null,
                baselineAfter: { 'a.two': 'decorative' },
            }),
            expected: ['a.two'],
        },
        {
            name: 'several stale keys come back sorted',
            input: enGate({
                baselineBefore: null,
                baselineAfter: { 'a.two': 'r', 'a.one': 'r', 'a.gone': 'r' },
            }),
            expected: ['a.gone', 'a.one', 'a.two'],
        },
    ]
    for (const { name, input, expected } of cases) {
        const result = evaluate(input)
        assert.equal(result.ok, false, name)
        assert.deepEqual(result.stale, expected, name)
        const waived = evaluate({ ...input, exception: EXCEPTION })
        assert.equal(waived.ok, false, `${name}: an exception must not waive stale entries`)
    }
})

test('a complete unscoped English run fails on new never-shown keys, even with an exception line', () => {
    const text3 = { 'a.one': 'Alpha one', 'a.zz': 'Zed', 'a.bb': 'Bee' }
    const cases = [
        {
            name: 'unlisted gap',
            input: enGate({ afterShown: ['a.one'], baselineBefore: null }),
            expected: ['a.two'],
        },
        {
            name: 'several gaps come back sorted',
            input: enGate({
                beforeText: text3,
                afterText: text3,
                beforeShown: ['a.one'],
                afterShown: ['a.one'],
                baselineBefore: null,
            }),
            expected: ['a.bb', 'a.zz'],
        },
    ]
    for (const { name, input, expected } of cases) {
        const result = evaluate(input)
        assert.equal(result.ok, false, name)
        assert.deepEqual(result.newGaps, expected, name)
        assert.equal(evaluate({ ...input, exception: EXCEPTION }).ok, false, `${name}: exception must not help`)
    }
})

test('baseline rules only apply to unscoped English reports', () => {
    const scopedComplete = enGate({
        afterShown: ['a.one'],
        beforeShown: ['a.one'],
        afterState: { scope: SCOPE, complete: true },
        baselineBefore: null,
        baselineAfter: { 'a.one': 'listed although shown', 'a.gone': 'listed although deleted' },
    })
    const incomplete = enGate({ afterShown: ['a.one'], afterState: { complete: false }, baselineBefore: null })
    const otherLocale = enGate({ baselineBefore: null })
    otherLocale.reports.push({
        locale: 'es-419',
        before: state(['a.one', 'a.two']),
        after: state(['a.one']),
    })
    otherLocale.catalogues['es-419'] = { before: texts(BASE_TEXT), after: texts(BASE_TEXT) }
    const cases = [
        ['scoped en report with a stale-looking baseline', scopedComplete],
        ['incomplete en report with an unlisted gap', incomplete],
        ['non-English report that misses a key', otherLocale],
    ]
    for (const [name, input] of cases) {
        const result = evaluate(input)
        assert.equal(result.ok, true, `${name}: ${result.reason}`)
        assert.deepEqual(result.stale, [], name)
        assert.deepEqual(result.newGaps, [], name)
    }
})

test('growing the baseline fails unless an exception line is present', () => {
    const text3 = { ...BASE_TEXT, 'a.three': 'Gamma three' }
    const common = { beforeText: text3, afterText: text3, beforeShown: ['a.one'], afterShown: ['a.one'] }
    const grown = enGate({
        ...common,
        baselineBefore: { 'a.two': 'decorative' },
        baselineAfter: { 'a.two': 'decorative', 'a.three': 'decorative too' },
    })
    const failing = evaluate(grown)
    assert.equal(failing.ok, false)
    assert.deepEqual(failing.grown, ['a.three'])
    const waived = evaluate({ ...grown, exception: EXCEPTION })
    assert.equal(waived.ok, true, waived.reason)

    const notGrown = [
        [
            'no previous baseline to compare with',
            enGate({
                ...common,
                baselineBefore: null,
                baselineAfter: { 'a.two': 'decorative', 'a.three': 'decorative too' },
            }),
        ],
        [
            'reason edited but key kept',
            enGate({
                ...common,
                baselineBefore: { 'a.two': 'old reason', 'a.three': 'old reason' },
                baselineAfter: { 'a.two': 'new reason', 'a.three': 'new reason' },
            }),
        ],
        [
            'baseline shrank',
            enGate({
                ...common,
                afterShown: ['a.one', 'a.two', 'a.three'],
                baselineBefore: { 'a.two': 'decorative', 'a.three': 'decorative too' },
                baselineAfter: {},
            }),
        ],
    ]
    for (const [name, input] of notGrown) {
        const result = evaluate(input)
        assert.equal(result.ok, true, `${name}: ${result.reason}`)
        assert.deepEqual(result.grown, [], name)
    }

    const scopedGrowth = enGate({
        ...common,
        afterState: { scope: SCOPE },
        baselineBefore: {},
        baselineAfter: { 'a.two': 'decorative' },
    })
    const scoped = evaluate(scopedGrowth)
    assert.deepEqual(scoped.grown, ['a.two'], 'growth is a property of the baseline file, not of the report scope')
    assert.equal(scoped.ok, false)
})

test('every rule reports its findings together', () => {
    const text3 = { ...BASE_TEXT, 'a.three': 'Gamma three' }
    const result = evaluate(
        enGate({
            beforeText: BASE_TEXT,
            afterText: text3,
            beforeShown: ['a.one', 'a.two'],
            afterShown: ['a.one'],
            baselineBefore: null,
            baselineAfter: { 'a.one': 'now shown' },
        })
    )
    assert.equal(result.ok, false)
    assert.deepEqual(result.stale, ['a.one'])
    assert.deepEqual(result.newGaps, ['a.three', 'a.two'])
    assert.deepEqual(result.unshownChanged, ['a.three'])
})

test('failure reasons tell the author what to run, how many keys, and which file to edit', () => {
    const baselineProblems = [
        {
            name: 'stale',
            input: enGate({ baselineBefore: null, baselineAfter: { 'a.one': 'r', 'a.two': 'r' } }),
            count: /\b2\b/,
        },
        {
            name: 'new gaps',
            input: enGate({ afterShown: [], beforeShown: [], baselineBefore: null }),
            count: /\b2\b/,
        },
        {
            name: 'grown baseline',
            input: enGate({
                afterShown: [],
                baselineBefore: {},
                baselineAfter: { 'a.one': 'r', 'a.two': 'r' },
            }),
            count: /\b2\b/,
        },
    ]
    for (const { name, input, count } of baselineProblems) {
        const result = evaluate(input)
        assert.equal(result.ok, false, name)
        assert.match(result.reason, /copy-coverage-baseline\.json/, name)
        assert.match(result.reason, /Add a capture state/, name)
        assert.match(result.reason, count, name)
    }
    const unshown = evaluate(
        enGate({
            afterText: { ...BASE_TEXT, 'a.new': 'Brand new' },
            afterShown: ['a.one', 'a.two'],
            afterState: { scope: SCOPE },
        })
    )
    assert.equal(unshown.ok, false)
    assert.match(unshown.reason, /Add a capture state/)
})

// nextBaseline: regenerating copy-coverage-baseline.json from a complete English capture
const validCapture = (overrides = {}) => ({
    schema: 1,
    type: 'capture',
    commit: 'a'.repeat(40),
    contentCommit: 'b'.repeat(40),
    harness: 'c'.repeat(64),
    fixtures: 'd'.repeat(64),
    locale: 'en',
    environment: 'test',
    adapter: 'v1',
    capturedAt: '2026-10-19T00:00:00Z',
    profile: 'en-393x852',
    width: 393,
    height: 852,
    copyRecording: 'recorded',
    screens: [
        {
            id: 's1',
            name: 'S1',
            flow: 'Home',
            kind: 'route',
            status: 'captured',
            image: `${'e'.repeat(64)}.png`,
            thumbnail: `${'e'.repeat(64)}.png`,
            copy: ['a.b'],
        },
    ],
    inventory: [{ route: '/home', status: 'catalogued', screens: ['s1'] }],
    ...overrides,
})

const catalogue = () =>
    new Map([
        ['a.b', 'Shown text'],
        ['c.d', 'Never shown'],
        ['e.f', 'Another never shown'],
    ])

test('nextBaseline keeps previous reasons, drops fixed keys, and adds new ones only on request', () => {
    const previous = new Map([
        ['c.d', 'old reason'],
        ['a.b', 'was never shown, is now'],
        ['x.gone', 'left the catalogue'],
    ])
    const kept = nextBaseline({ capture: validCapture(), catalogue: catalogue(), previous, addNew: false })
    assert.equal(kept.schema, 1)
    assert.deepEqual({ ...kept.keys }, { 'c.d': 'old reason' })

    const added = nextBaseline({ capture: validCapture(), catalogue: catalogue(), previous, addNew: true })
    assert.equal(added.schema, 1)
    assert.deepEqual(Object.keys(added.keys).sort(), ['c.d', 'e.f'])
    assert.equal(added.keys['c.d'], 'old reason')
    assert.equal(typeof added.keys['e.f'], 'string')
    assert.ok(added.keys['e.f'].trim().length > 0)
    assert.equal(parseCopyBaseline(plainJson(added)).size, 2, 'the generated file must parse back')

    const fromScratch = nextBaseline({
        capture: validCapture(),
        catalogue: catalogue(),
        previous: new Map(),
        addNew: true,
    })
    assert.deepEqual(Object.keys(fromScratch.keys).sort(), ['c.d', 'e.f'])
    const nothingNew = nextBaseline({
        capture: validCapture(),
        catalogue: catalogue(),
        previous: new Map(),
        addNew: false,
    })
    assert.deepEqual({ ...nothingNew.keys }, {})
})

test('nextBaseline refuses captures that are not complete, unscoped English recordings', () => {
    const bad = [
        ['locale es-419', validCapture({ locale: 'es-419' })],
        ['locale pt-BR', validCapture({ locale: 'pt-BR' })],
        ['scoped run', validCapture({ scope: { screens: ['s1'] } })],
        ['copy not recorded', validCapture({ copyRecording: 'unsupported' })],
        ['copy recording missing', validCapture({ copyRecording: undefined })],
        ['not an object', null],
        ['empty object', {}],
    ]
    for (const [name, capture] of bad)
        assert.throws(
            () => nextBaseline({ capture, catalogue: catalogue(), previous: new Map(), addNew: true }),
            undefined,
            name
        )
})

// prepare: the adapter injects the copy recorder next to the next-intl provider
test('prepare wires the copy recorder into IntlCore once and leaves files without the anchor alone', () => {
    const dir = mkdtempSync(join(tmpdir(), 'screen-copy-recorder-'))
    try {
        mkdirSync(join(dir, 'src/i18n/app'), { recursive: true })
        const file = join(dir, 'src/i18n/app/IntlCore.tsx')
        const anchored = [
            'export function IntlCore({ locale, messages, timeZone, children }) {',
            '    return (',
            '        <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>',
            '            {children}',
            '        </NextIntlClientProvider>',
            '    )',
            '}',
            '',
        ].join('\n')
        writeFileSync(file, anchored)

        prepare(dir)
        const prepared = readFileSync(file, 'utf8')
        assert.notEqual(prepared, anchored)
        assert.ok(prepared.includes('/* screen-capture-copy-v1 */'), 'marker is present')
        assert.ok(prepared.includes('__screenCaptureCopy?.(messages) ?? messages'), 'messages go through the recorder')

        prepare(dir)
        assert.equal(readFileSync(file, 'utf8'), prepared, 'a second prepare changes nothing more')

        const unanchored = 'export function IntlCore() {\n    return <Provider locale="en" />\n}\n'
        writeFileSync(file, unanchored)
        assert.doesNotThrow(() => prepare(dir))
        assert.equal(readFileSync(file, 'utf8'), unanchored, 'a file without the JSX anchor is left untouched')
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
})
