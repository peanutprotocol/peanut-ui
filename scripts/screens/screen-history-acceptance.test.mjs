import test from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

// Frozen spec-only tests. Runtime reads execute the viewer as a black box only.
const viewerPath =
    process.env.SCREEN_HISTORY_VIEWER ||
    fileURLToPath(new URL('../../public/screen-library/viewer.js', import.meta.url))
const PROPERTY_SEED = 0x51a7e202
const scope = { source: 'synthetic', channel: 'dev', locale: 'en', profile: '393x852' }
const asset = (n) => n.toString(16).padStart(64, '0') + '.png'
const commit = (n) => n.toString(16).padStart(40, '0')
const day = (n) => `2026-09-${String(n).padStart(2, '0')}`
const clone = (v) => JSON.parse(JSON.stringify(v))
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

class Element {
    constructor() {
        this.children = []
        this.dataset = {}
        this.style = {}
        this.value = ''
        this.checked = false
        this.hidden = false
        this.textContent = ''
        this.classList = {
            add() {},
            remove() {},
            toggle() {},
            contains() {
                return false
            },
        }
    }
    addEventListener() {}
    append(...items) {
        this.children.push(...items)
    }
    appendChild(item) {
        this.append(item)
        return item
    }
    replaceChildren(...items) {
        this.children = items
    }
    setAttribute(name, value) {
        this[name] = value
    }
    getAttribute(name) {
        return this[name] ?? null
    }
    querySelector() {
        return new Element()
    }
    querySelectorAll() {
        return []
    }
    scrollBy() {}
    showModal() {
        this.open = true
    }
    close() {
        this.open = false
    }
    focus() {}
}

function harness(overrides = {}) {
    const elements = new Map()
    const document = {
        body: new Element(),
        documentElement: new Element(),
        getElementById(id) {
            if (!elements.has(id)) elements.set(id, new Element())
            return elements.get(id)
        },
        querySelector() {
            return new Element()
        },
        querySelectorAll() {
            return []
        },
        createElement() {
            return new Element()
        },
        addEventListener() {},
    }
    const context = vm.createContext({
        document,
        window: { addEventListener() {}, requestAnimationFrame() {} },
        location: { pathname: '/screens/', protocol: 'https:', search: '', hash: '' },
        history: { replaceState() {} },
        fetch: async () => ({ ok: true, status: 200, json: async () => [] }),
        AbortController,
        DOMException,
        setTimeout,
        clearTimeout,
        URL,
        URLSearchParams,
        Date,
        console,
        requestAnimationFrame() {},
        ...overrides,
    })
    vm.runInContext(fs.readFileSync(viewerPath, 'utf8'), context, { filename: viewerPath })
    function call(name, ...args) {
        context.__args = args
        return vm.runInContext(`${name}(...__args)`, context)
    }
    return { call, context }
}
function entry(n, extras = {}) {
    const { channel = 'dev', ...fields } = extras
    return {
        path: `${day(n)}/${channel}/en/${commit(n)}`,
        date: day(n),
        branch: channel.replace(/^compare-/, ''),
        source: 'synthetic',
        locale: 'en',
        profile: '393x852',
        commit: commit(n),
        sequence: n,
        attempt: 1,
        complete: true,
        reportType: 'capture',
        ...fields,
    }
}
const reportURL = (entry) => `/screen-data/reports/${entry.path}/manifest.json`
function screen(n, extras = {}) {
    return {
        id: 'account-home',
        name: 'Account home',
        flow: 'account',
        kind: 'app-state',
        status: 'captured',
        image: asset(n),
        ...extras,
    }
}
function capture(n, extras = {}) {
    return {
        schema: 1,
        type: 'capture',
        capturedAt: `${day(n)}T12:00:00Z`,
        commit: commit(n),
        locale: 'en',
        profile: 'en-393x852',
        width: 393,
        height: 852,
        screens: [screen(n)],
        ...extras,
    }
}
function record(n, imageN = n, extra = {}) {
    return { entry: entry(n), report: capture(n, { screens: [screen(imageN)] }), ...extra }
}
function comparison(n, beforeImage, afterImage, extras = {}) {
    const before = capture(n - 1, { screens: [screen(beforeImage)] })
    const after = capture(n, { screens: [screen(afterImage)] })
    return {
        schema: 1,
        type: 'comparison',
        before,
        after,
        screens: [
            {
                id: 'account-home',
                name: 'Account home',
                before: before.screens[0],
                after: after.screens[0],
                status: 'changed',
                percent: 2,
                ...extras,
            },
        ],
    }
}
function build(h, records, opts = {}) {
    return clone(h.call('buildScreenHistory', records, { id: 'account-home', scope, ...opts }))
}
const images = (result) => result.versions.map((v) => v.image)

// Dates are provenance, never a fallback to the current time.
test('dates use UTC tiles and include only a non-current year', () => {
    const h = harness()
    assert.deepEqual(
        clone(h.call('screenHistoryDate', '2026-09-04T23:30:00-02:00', new Date('2026-10-14T00:00:00Z'))),
        { day: '5', month: 'Sep', year: '' }
    )
    assert.deepEqual(clone(h.call('screenHistoryDate', '2025-12-31', new Date('2026-01-01T00:00:00Z'))), {
        day: '31',
        month: 'Dec',
        year: '2025',
    })
})
test('invalid, missing, and normalized impossible dates are unknown', () => {
    const h = harness()
    for (const value of [
        undefined,
        null,
        '',
        'not-a-date',
        '2026-02-29',
        '2026-02-30T12:00:00Z',
        '2026-04-31',
        '2026-13-01',
        '2026-09-00',
        '2026-09-01T25:00:00Z',
    ]) {
        assert.deepEqual(
            clone(h.call('screenHistoryDate', value, new Date('2026-10-14T00:00:00Z'))),
            { day: '?', month: 'Unknown', year: '' },
            String(value)
        )
    }
})
test('valid leap dates and UTC year boundaries remain valid', () => {
    const h = harness()
    assert.deepEqual(clone(h.call('screenHistoryDate', '2024-02-29', new Date('2026-10-14T00:00:00Z'))), {
        day: '29',
        month: 'Feb',
        year: '2024',
    })
    assert.deepEqual(
        clone(h.call('screenHistoryDate', '2026-01-01T00:30:00+01:00', new Date('2026-01-01T00:00:00Z'))),
        { day: '31', month: 'Dec', year: '2025' }
    )
})
test('scope canonicalizes comparison channels and legacy dev channels', () => {
    const h = harness()
    for (const channel of ['dev', 'compare-dev', `dev-${commit(1)}`]) {
        assert.deepEqual(clone(h.call('screenHistoryScope', entry(1, { channel }), capture(1))), scope)
    }
    assert.equal(h.call('screenHistoryScope', entry(1, { channel: 'compare-main' }), capture(1)).channel, 'main')
    assert.equal(h.call('screenHistoryScope', entry(1, { channel: 'pr-42' }), capture(1)).channel, 'pr-42')
})
test('scope defaults missing metadata and rejects unsupported channels', () => {
    const h = harness()
    assert.deepEqual(clone(h.call('screenHistoryScope', { path: entry(1).path }, capture(1))), scope)
    for (const channel of ['journey', 'feature-unpublished', 'pr-nope'])
        assert.equal(h.call('screenHistoryScope', entry(1, { channel }), capture(1)), null)
})
test('entries isolate source, canonical channel, locale, and viewport', () => {
    const h = harness()
    const wanted = [entry(1), entry(2, { channel: 'compare-dev', path: `${day(2)}/compare-dev/en/${commit(2)}` })]
    const excluded = [
        entry(3, { channel: 'main', path: `${day(3)}/main/en/${commit(3)}` }),
        entry(4, { source: 'production' }),
        entry(5, { locale: 'fr', path: `${day(5)}/dev/fr/${commit(5)}` }),
        entry(6, { profile: '768x1024', path: `${day(6)}/dev/en/768x1024/${commit(6)}` }),
        entry(7, { channel: 'pr-42', path: `${day(7)}/pr-42/en/${commit(7)}` }),
    ]
    assert.deepEqual(
        clone(h.call('screenHistoryEntries', [...excluded, ...wanted], scope)).map((v) => v.path),
        wanted.reverse().map((v) => v.path)
    )
})
test('entries use stable date/sequence/attempt/path ordering and deduplicate paths', () => {
    const h = harness()
    const entries = [
        entry(2, { sequence: 1, attempt: 1 }),
        entry(3, { date: day(2), path: `${day(2)}/dev/en/${commit(3)}`, sequence: 2, attempt: 1 }),
        entry(4, { date: day(2), path: `${day(2)}/dev/en/${commit(4)}`, sequence: 2, attempt: 2 }),
        entry(1),
    ]
    const result = clone(h.call('screenHistoryEntries', [...entries, entries[2]], scope))
    assert.deepEqual(
        result.map((e) => e.path),
        [entries[2], entries[1], entries[0], entries[3]].map((e) => e.path)
    )
    const equal = [
        entry(5, { date: day(2), path: `${day(2)}/dev/en/${commit(5)}`, sequence: 2 }),
        entry(6, { date: day(2), path: `${day(2)}/dev/en/${commit(6)}`, sequence: 2 }),
    ]
    assert.deepEqual(
        clone(h.call('screenHistoryEntries', equal, scope)),
        clone(h.call('screenHistoryEntries', [...equal].reverse(), scope))
    )
})
test('unsafe, malformed, and impossible-date paths never enter history', () => {
    const h = harness()
    const bad = [
        '../secret',
        '/absolute/report',
        'https://evil.example/report',
        '//evil.example/report',
        `${day(1)}/dev/en/../${commit(1)}`,
        `${day(1)}/dev/en/%2e%2e/${commit(1)}`,
        `2026-02-30/dev/en/${commit(1)}`,
        `${day(1)}/dev/en/not-a-commit`,
        `${day(1)}/dev/en/${commit(1)}?token=secret`,
        `${day(1)}/dev/en/${commit(1)}#fragment`,
    ]
    assert.deepEqual(
        clone(
            h.call(
                'screenHistoryEntries',
                bad.map((path) => entry(1, { path })),
                scope
            )
        ),
        []
    )
})
test('same-image consecutive captures collapse but A-B-A remains', () => {
    const h = harness()
    assert.deepEqual(images(build(h, [record(4, 1), record(2, 1), record(3, 2), record(1, 1)])), [
        asset(1),
        asset(2),
        asset(1),
    ])
})
test('multiple visual changes on one date are preserved in capture-time order', () => {
    const h = harness()
    const records = [1, 2, 3].map((n) =>
        record(n, n, {
            report: capture(n, {
                capturedAt: `${day(1)}T${String(n + 9).padStart(2, '0')}:00:00Z`,
                screens: [screen(n)],
            }),
        })
    )
    assert.deepEqual(images(build(h, records.reverse())), [asset(1), asset(2), asset(3)])
})
test('seeded adjacent-dedup property preserves exactly the chronological run heads', () => {
    const h = harness()
    let state = PROPERTY_SEED
    const random = () => {
        state ^= state << 13
        state ^= state >>> 17
        state ^= state << 5
        return state >>> 0
    }
    for (let trial = 0; trial < 80; trial++) {
        const values = Array.from({ length: 24 }, () => 1 + (random() % 5))
        const expected = values.filter((value, i) => i === 0 || value !== values[i - 1]).map(asset)
        const records = values.map((value, i) => record(i + 1, value))
        for (let i = records.length - 1; i > 0; i--) {
            const j = random() % (i + 1)
            ;[records[i], records[j]] = [records[j], records[i]]
        }
        assert.deepEqual(images(build(h, records)), expected, `seed=${PROPERTY_SEED}; trial=${trial}`)
    }
})
test('failed capture observations are gaps rather than confirmed removals', () => {
    const h = harness()
    for (const status of ['failed', 'excluded', 'unavailable']) {
        const failed = record(2, 2, { report: capture(2, { screens: [screen(2, { status, image: null })] }) })
        const result = build(h, [record(1), failed, record(3)])
        assert.deepEqual(images(result), [asset(1), asset(3)], status)
        assert.ok(
            result.gaps.some((gap) => gap.reportPath === failed.entry.path),
            status
        )
    }
})
test('screen omitted from a capture is a gap rather than removal', () => {
    const h = harness()
    const missing = record(2, 2, { report: capture(2, { screens: [] }) })
    const result = build(h, [record(1), missing, record(3)])
    assert.deepEqual(images(result), [asset(1), asset(3)])
    assert.ok(result.gaps.some((gap) => gap.reportPath === missing.entry.path))
})
test('explicit removal and restoration preserve absence and restored identical image', () => {
    const h = harness()
    const removed = record(2, 2, { report: capture(2, { screens: [screen(2, { status: 'absent', image: null })] }) })
    assert.deepEqual(images(build(h, [record(1), removed, record(3, 1)])), [asset(1), null, asset(1)])
})
test('duplicate library/comparison observations produce one immutable snapshot', () => {
    const h = harness()
    const duplicate = {
        entry: entry(2, { channel: 'compare-dev', path: `${day(2)}/compare-dev/en/${commit(2)}` }),
        report: comparison(2, 1, 2),
    }
    assert.deepEqual(images(build(h, [record(1), record(2), duplicate])), [asset(1), asset(2)])
})
test('trusted tiny pixel noise against the immediately observed baseline is omitted', () => {
    const h = harness()
    const noise = {
        entry: entry(2, { channel: 'compare-dev', path: `${day(2)}/compare-dev/en/${commit(2)}` }),
        report: comparison(2, 1, 2, { percent: 0.001, belowThreshold: true }),
    }
    assert.deepEqual(images(build(h, [record(1), noise])), [asset(1)])
    delete noise.report.screens[0].belowThreshold
    assert.deepEqual(
        images(build(h, [record(1), noise])),
        [asset(1)],
        'rounded percent normalizes legacy rows without the explicit flag'
    )
    const nextNoise = { entry: entry(3, { channel: 'compare-dev' }), report: comparison(3, 2, 3, { percent: 0.001 }) }
    assert.deepEqual(
        images(build(h, [record(1), noise, nextNoise])),
        [asset(1)],
        'trust tracks the last observation even when no visual version was emitted'
    )
})
test('below-threshold hints cannot hide change against an unrelated baseline', () => {
    const h = harness()
    const unrelated = {
        entry: entry(2, { channel: 'compare-dev', path: `${day(2)}/compare-dev/en/${commit(2)}` }),
        report: comparison(2, 9, 2, { percent: 0.001, belowThreshold: true }),
    }
    assert.deepEqual(images(build(h, [record(1), unrelated])), [asset(1), asset(2)])
})
test('PR history uses the first before baseline and never later updated dev bases', () => {
    const h = harness()
    const prScope = { ...scope, channel: 'pr-42' }
    const records = [2, 3].map((n) => ({
        entry: entry(n, { channel: 'pr-42', path: `${day(n)}/pr-42/en/${commit(n)}` }),
        report: comparison(n, n === 2 ? 1 : 9, n),
    }))
    assert.deepEqual(images(build(h, records.reverse(), { scope: prScope })), [asset(1), asset(2), asset(3)])
})
test('history builder independently enforces exact PR, source, locale and profile scope', () => {
    const h = harness()
    const foreign = [
        record(2, 2, { entry: entry(2, { channel: 'pr-2', path: `${day(2)}/pr-2/en/${commit(2)}` }) }),
        record(3, 3, { entry: entry(3, { source: 'other' }) }),
        record(4, 4, { entry: entry(4, { locale: 'fr', path: `${day(4)}/dev/fr/${commit(4)}` }) }),
        record(5, 5, { entry: entry(5, { profile: '768x1024', path: `${day(5)}/dev/en/768x1024/${commit(5)}` }) }),
    ]
    assert.deepEqual(images(build(h, [record(1), ...foreign])), [asset(1)])
})
test('missing capture time retains publication provenance and does not invent now', () => {
    const h = harness()
    const r = record(1)
    delete r.report.capturedAt
    const result = build(h, [r])
    assert.equal(result.versions.length, 1)
    assert.equal(result.versions[0].timeKnown, false)
    assert.ok(!result.versions[0].capturedAt || result.versions[0].capturedAt.startsWith(day(1)))
    assert.equal(result.versions[0].reportPath, r.entry.path)
})
test('malformed capture times do not masquerade as known provenance', () => {
    const h = harness()
    const result = build(h, [record(1, 1, { report: capture(1, { capturedAt: '2026-02-30T12:00:00Z' }) })])
    assert.equal(result.versions.length, 1)
    assert.equal(result.versions[0].timeKnown, false)
})
test('unsafe assets cannot become versions and names remain literal text', () => {
    const h = harness()
    for (const image of [
        '../secret.png',
        'https://evil.example/a.png',
        '//evil.example/a.png',
        'javascript:alert(1)',
        `${asset(1)}?x=1`,
    ]) {
        const result = build(h, [record(1, 1, { report: capture(1, { screens: [screen(1, { image })] }) })])
        assert.equal(result.versions.length, 0, image)
        assert.ok(result.gaps.length > 0, image)
    }
    const name = '<img src=x onerror=alert(1)>'
    assert.equal(
        build(h, [record(1, 1, { report: capture(1, { screens: [screen(1, { name })] }) })]).versions[0].name,
        name
    )
})
test('models do not mutate caller-owned records or index and are deterministic on equal times', () => {
    const h = harness()
    const records = [record(2), record(1)]
    records.forEach((r) => {
        r.report.capturedAt = `${day(1)}T12:00:00Z`
    })
    const snapshot = clone(records)
    const one = build(h, records)
    assert.deepEqual(records, snapshot)
    assert.deepEqual(one, build(h, [...records].reverse()))
    const index = records.map((r) => r.entry)
    const indexSnapshot = clone(index)
    h.call('screenHistoryEntries', index, scope)
    assert.deepEqual(index, indexSnapshot)
})

test('loader pages all 29 manifests in batches of 12 without a hidden total cap', { timeout: 2000 }, async () => {
    const h = harness()
    const entries = Array.from({ length: 29 }, (_, i) => entry(i + 1))
    const requested = []
    const found = []
    let offset = 0
    const sizes = []
    for (let page = 0; page < 3; page++) {
        const result = await h.call('loadScreenHistoryPage', entries, {
            offset,
            load: async (path) => {
                requested.push(path)
                return capture(1)
            },
        })
        sizes.push(result.records.length)
        found.push(...result.records)
        offset = result.nextOffset
        assert.equal(result.done, page === 2)
        assert.equal(result.failures.length, 0)
    }
    assert.deepEqual(sizes, [12, 12, 5])
    assert.equal(offset, 29)
    assert.equal(found.length, 29)
    assert.equal(new Set(requested).size, 29)
})
test('loader bounds concurrency at four while out-of-order results all survive', { timeout: 2000 }, async () => {
    const h = harness()
    const entries = Array.from({ length: 12 }, (_, i) => entry(i + 1))
    let active = 0
    let peak = 0
    const waiting = []
    const progress = []
    const task = h.call('loadScreenHistoryPage', entries, {
        load: (path, { signal }) =>
            new Promise((resolve) => {
                assert.ok(signal)
                active++
                peak = Math.max(peak, active)
                waiting.push(() => {
                    active--
                    resolve(capture(1))
                })
            }),
        onProgress: (...args) => progress.push(args),
    })
    for (let step = 0; step < 12; step++) {
        await tick()
        assert.ok(waiting.length > 0)
        waiting.pop()()
    }
    const result = await task
    assert.ok(peak <= 4)
    assert.equal(result.records.length, 12)
    assert.equal(result.failures.length, 0)
    assert.ok(progress.length > 0)
})
test('loader retains successes and explicitly retries only selected failed reads', { timeout: 2000 }, async () => {
    const h = harness()
    const entries = [entry(1), entry(2), entry(3)]
    const calls = new Map()
    const load = async (path) => {
        calls.set(path, (calls.get(path) || 0) + 1)
        if (path === reportURL(entries[1]) && calls.get(path) === 1) throw new Error('fixture transient')
        return capture(1)
    }
    const first = await h.call('loadScreenHistoryPage', entries, { load })
    assert.equal(first.records.length, 2)
    assert.equal(first.failures.length, 1)
    assert.equal(first.failures[0].entry.path, entries[1].path)
    assert.ok(first.failures[0].error)
    assert.equal(calls.get(reportURL(entries[1])), 1)
    const recovered = await h.call(
        'loadScreenHistoryPage',
        first.failures.map((f) => f.entry),
        { load }
    )
    assert.equal(recovered.records.length, 1)
    assert.equal(recovered.failures.length, 0)
    assert.equal(calls.get(reportURL(entries[0])), 1)
    assert.equal(calls.get(reportURL(entries[2])), 1)
    assert.equal(calls.get(reportURL(entries[1])), 2)
})
test('loader never passes unsafe paths to the injected reader', { timeout: 2000 }, async () => {
    const h = harness()
    const calls = []
    const entries = [entry(1), entry(2, { path: '../private' }), entry(3, { path: 'https://evil.example/report' })]
    const result = await h.call('loadScreenHistoryPage', entries, {
        load: async (path) => {
            calls.push(path)
            return capture(1)
        },
    })
    assert.deepEqual(calls, [reportURL(entries[0])])
    assert.equal(result.records.length, 1)
    assert.equal(result.failures.length, 2)
})
test('already-aborted pages reject without scheduling any reader', { timeout: 2000 }, async () => {
    const h = harness()
    const controller = new AbortController()
    controller.abort()
    let calls = 0
    await assert.rejects(
        h.call('loadScreenHistoryPage', [entry(1)], {
            signal: controller.signal,
            load: async () => {
                calls++
                return capture(1)
            },
        }),
        { name: 'AbortError' }
    )
    assert.equal(calls, 0)
})
test(
    'abort stops queued work, aborts in-flight reads, and leaves no unhandled rejection',
    { timeout: 2000 },
    async () => {
        const h = harness()
        const controller = new AbortController()
        const unhandled = []
        const signals = []
        let calls = 0
        const listener = (error) => unhandled.push(error)
        process.on('unhandledRejection', listener)
        try {
            const promise = h.call(
                'loadScreenHistoryPage',
                Array.from({ length: 12 }, (_, i) => entry(i + 1)),
                {
                    signal: controller.signal,
                    load: (_path, { signal }) =>
                        new Promise((_resolve, reject) => {
                            calls++
                            signals.push(signal)
                            signal.addEventListener(
                                'abort',
                                () => reject(new DOMException('Aborted fixture', 'AbortError')),
                                { once: true }
                            )
                        }),
                }
            )
            const rejected = assert.rejects(promise, { name: 'AbortError' })
            await tick()
            controller.abort()
            await rejected
            await tick()
            await tick()
            assert.ok(calls > 0 && calls <= 4)
            assert.ok(signals.every((signal) => signal.aborted))
            assert.deepEqual(unhandled, [])
        } finally {
            process.removeListener('unhandledRejection', listener)
        }
    }
)
test('manifest reads enforce an 8000ms timeout with no automatic retry', { timeout: 2000 }, async () => {
    const timers = new Map()
    let timerId = 0
    let useFakeTimers = false
    const h = harness({
        setTimeout(callback, ms, ...args) {
            if (!useFakeTimers) return setTimeout(callback, ms, ...args)
            const id = ++timerId
            timers.set(id, { callback, ms, args })
            return id
        },
        clearTimeout(id) {
            if (timers.has(id)) timers.delete(id)
            else clearTimeout(id)
        },
    })
    useFakeTimers = true
    let calls = 0
    let observedSignal
    const task = h.call('loadScreenHistoryPage', [entry(1)], {
        load: (_path, { signal }) => {
            calls++
            observedSignal = signal
            return new Promise((_resolve, reject) =>
                signal.addEventListener('abort', () => reject(new DOMException('Timeout fixture', 'AbortError')), {
                    once: true,
                })
            )
        },
    })
    await tick()
    const timeout = [...timers.values()].find((timer) => timer.ms === 8000)
    assert.ok(timeout, 'each read has the specified 8 second budget')
    timeout.callback(...timeout.args)
    const result = await task
    assert.equal(calls, 1)
    assert.equal(observedSignal.aborted, true)
    assert.equal(result.records.length, 0)
    assert.equal(result.failures.length, 1)
})

test('invalid screen IDs cannot select history or fall back to another screen', () => {
    const h = harness()
    for (const id of ['', '../account-home', 'ACCOUNT-HOME', 'x'.repeat(121), '<script>']) {
        assert.deepEqual(images(build(h, [record(1)], { id })), [], id)
    }
})
