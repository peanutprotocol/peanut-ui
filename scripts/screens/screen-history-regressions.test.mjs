import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'

const source = fs.readFileSync(new URL('../../public/screen-library/viewer.js', import.meta.url), 'utf8')
const scope = { source: 'synthetic', channel: 'dev', locale: 'en', profile: '393x852' }
const sha = (n, length = 40) => String(n).padStart(length, '0')
const asset = (n) => `${sha(n, 64)}.png`
const screen = (n, extras = {}) => ({
    id: 'example-component',
    name: 'Example',
    kind: 'component',
    status: 'captured',
    image: asset(n),
    ...extras,
})
const capture = (n, extras = {}) => ({
    schema: 1,
    type: 'capture',
    source: 'synthetic',
    locale: 'en',
    width: 393,
    height: 852,
    commit: sha(n),
    capturedAt: `2026-10-${String(n).padStart(2, '0')}T12:00:00Z`,
    screens: [screen(n)],
    ...extras,
})
const entry = (n, channel = 'dev') => ({
    path: `2026-10-${String(n).padStart(2, '0')}/${channel}/en/${sha(n)}`,
    date: `2026-10-${String(n).padStart(2, '0')}`,
    source: 'synthetic',
    locale: 'en',
    profile: '393x852',
})
const record = (n) => ({ entry: entry(n), report: capture(n) })
const comparison = (n, before, extras = {}) => ({
    entry: entry(n, 'compare-dev'),
    report: {
        schema: 1,
        type: 'comparison',
        locale: 'en',
        before: capture(before),
        after: capture(n),
        screens: [
            {
                id: 'example-component',
                before: screen(before),
                after: screen(n),
                status: 'changed',
                percent: 2,
                ...extras,
            },
        ],
    },
})

function harness(protocol = 'https:') {
    const elements = new Map()
    const element = () => ({
        children: [],
        style: {},
        dataset: {},
        value: '',
        classList: { add() {}, remove() {}, toggle() {} },
        listeners: new Map(),
        addEventListener(name, listener) {
            this.listeners.set(name, listener)
        },
        setAttribute(name, value) {
            this[name] = value
        },
        append(...items) {
            this.children.push(...items)
        },
        replaceChildren(...items) {
            this.children = items
        },
        querySelector() {
            return null
        },
        focus() {},
    })
    const document = {
        body: element(),
        createElement: element,
        querySelector: element,
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, element())
            return elements.get(id)
        },
    }
    const context = vm.createContext({
        document,
        location: { protocol, pathname: '/screens/', search: '', hash: '' },
        window: {},
        history: { replaceState() {} },
        fetch: async () => ({ ok: true, json: async () => [] }),
        AbortController,
        DOMException,
        URLSearchParams,
        setTimeout,
        clearTimeout,
        console,
    })
    vm.runInContext(source, context)
    const call = (name, ...args) => {
        context.args = args
        return vm.runInContext(`${name}(...args)`, context)
    }
    return { context, call }
}
const build = (h, records, options = {}) =>
    h.call('buildScreenHistory', records, { id: 'example-component', scope, ...options })
const images = (result) => Array.from(result.versions, (v) => v.image)

test('published isolated components expose the same history entry point as routes', () => {
    const h = harness()
    h.context.currentEntry = entry(1)
    h.context.currentCapture = capture(1)
    vm.runInContext(
        'indexEntries = [currentEntry]; currentReportPath = currentEntry.path; report = currentCapture',
        h.context
    )
    assert.equal(h.call('historyEligible', screen(1)), true)
    assert.equal(h.call('historyEligible', screen(1, { kind: 'route' })), true)
})

test('publication metadata cannot mask a contradictory manifest scope', () => {
    const h = harness()
    for (const conflict of [{ locale: 'pt-BR' }, { width: 440, height: 956 }, { source: 'nutcracker' }]) {
        const r = { entry: entry(2), report: capture(2, conflict) }
        assert.equal(h.call('screenHistoryScope', r.entry, r.report), null)
        const result = build(h, [record(1), r])
        assert.deepEqual(images(result), [asset(1)])
        assert.equal(result.gaps.length, 1)
    }
})

test('paired library snapshots retain verified comparison noise hints before emission', () => {
    const h = harness()
    const a = record(1),
        b = record(2),
        noise = comparison(2, 1, { status: 'unchanged', belowThreshold: true, percent: 0.001 })
    for (const records of [
        [a, noise, b],
        [b, noise, a],
        [noise, b, a],
    ])
        assert.deepEqual(images(build(h, records)), [asset(1)])
    noise.report.screens[0].before = screen(9)
    assert.deepEqual(images(build(h, [a, noise, b])), [asset(1), asset(2)])
})

test('failed first PR observations never permit a later updated dev base as a PR version', () => {
    const h = harness()
    const first = comparison(2, 1)
    first.entry = entry(2, 'pr-42')
    first.report.screens[0].before = screen(1, { status: 'failed', image: null })
    first.report.screens[0].after = screen(2, { status: 'failed', image: null })
    const next = comparison(3, 9)
    next.entry = entry(3, 'pr-42')
    const result = build(h, [next, first], { scope: { ...scope, channel: 'pr-42' } })
    assert.deepEqual(images(result), [asset(3)])
    assert.ok(result.gaps.length > 0)
})

test('mixed malformed manifests remain visible gaps without crashing or claiming completeness', () => {
    const h = harness()
    for (const malformed of [
        null,
        undefined,
        42,
        'invalid',
        {},
        { schema: 2, type: 'capture', screens: [] },
        { schema: 1, type: 'unknown', screens: [] },
    ]) {
        const result = build(h, [record(1), { entry: entry(2), report: malformed }, record(3)])
        assert.deepEqual(images(result), [asset(1), asset(3)])
        assert.equal(result.gaps.length, 1)
        assert.equal(result.gaps[0].reportPath, entry(2).path)
    }
})

test('cancellation settles a reader that ignores its signal and stops queued reads', async () => {
    const h = harness()
    const controller = new AbortController()
    let calls = 0
    const pending = h.call(
        'loadScreenHistoryPage',
        Array.from({ length: 9 }, (_, i) => entry(i + 1)),
        {
            signal: controller.signal,
            load: () => {
                calls++
                return new Promise(() => {})
            },
        }
    )
    const rejected = assert.rejects(pending, { name: 'AbortError' })
    await new Promise((resolve) => setImmediate(resolve))
    controller.abort()
    await rejected
    assert.equal(calls, 4)
})

test('retry pages fairly rotate through more than twelve persistent failures and retain successes', async () => {
    const h = harness()
    const entries = Array.from({ length: 29 }, (_, index) => entry(index + 1))
    const retained = record(1)
    const state = {
        records: new Map([['retained-success', retained]]),
        failures: new Map(
            entries.map((entry) => [entry.path, { entry, error: new Error('Persistent fixture failure') }])
        ),
    }
    const attempted = []
    for (let page = 0; page < 3; page++) {
        const result = await h.call(
            'loadScreenHistoryPage',
            Array.from(state.failures.values(), ({ entry }) => entry),
            {
                load: async (path) => {
                    attempted.push(path)
                    throw new Error('Persistent fixture failure')
                },
            }
        )
        assert.equal(result.failures.length, 12)
        h.call('mergeHistoryReads', state, result)
    }
    assert.equal(attempted.length, 36)
    assert.equal(new Set(attempted).size, 29)
    assert.equal(state.failures.size, 29)
    assert.equal(state.records.get('retained-success'), retained)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(attempted.length, 36, 'no automatic retry loop')
})

test('offline, journey and collection reports explain unavailable history once per page', () => {
    const h = harness()
    for (const type of ['journeys', 'collection']) {
        h.context.fixture = { schema: 1, type }
        vm.runInContext('report = fixture; renderHistoryAvailability()', h.context)
        const message = h.context.document.getElementById('history-unavailable')
        assert.equal(message.hidden, false)
        assert.match(message.textContent, /history is unavailable/i)
    }
    // `offline` is fixed at viewer startup; a fresh VM models an offline bundle.
    const offline = harness('file:')
    vm.runInContext(
        'currentReportPath = ""; report = { type: "capture" }; renderHistoryAvailability()',
        offline.context
    )
    const explanation = offline.context.document.getElementById('history-unavailable')
    assert.equal(explanation.hidden, false)
    assert.match(explanation.textContent, /unavailable in offline reports/i)
})

test('invalid missing paths produce ordered diagnostics without reaching the reader', async () => {
    const h = harness()
    let calls = 0
    const entries = [{ path: null }, { path: undefined }, null, {}]
    const result = await h.call('loadScreenHistoryPage', entries, {
        load: async () => {
            calls++
            return capture(1)
        },
    })
    assert.equal(calls, 0)
    assert.equal(result.records.length, 0)
    assert.equal(result.failures.length, entries.length)
    assert.equal(result.done, true)
    assert.ok(result.failures.every(({ error }) => /Invalid immutable report path/.test(error.message)))
})

test('Escape closes history while the range slider retains native arrow behavior', () => {
    const h = harness()
    const panel = h.context.document.getElementById('screen-history')
    const slider = h.context.document.getElementById('history-slider')
    const listener = panel.listeners.get('keydown')
    vm.runInContext('historyState = { id: "example-component", controller: new AbortController() }', h.context)
    let prevented = false
    listener({
        key: 'ArrowRight',
        target: slider,
        preventDefault() {
            prevented = true
        },
    })
    assert.equal(prevented, false)
    assert.ok(vm.runInContext('historyState', h.context))
    listener({
        key: 'Escape',
        target: slider,
        preventDefault() {
            prevented = true
        },
    })
    assert.equal(prevented, true)
    assert.equal(vm.runInContext('historyState', h.context), null)
    assert.equal(panel.hidden, true)
})
