import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const viewer = readFileSync(new URL('../../public/screen-library/viewer.js', import.meta.url), 'utf8')
const elementIds = [
    'search',
    'flow',
    'status',
    'view-mode',
    'view-mode-control',
    'view-mode-row',
    'variations-mode',
    'source',
    'source-control',
    'branch',
    'branch-control',
    'locale',
    'screen-updates-only',
    'screen-updates-control',
    'profile',
    'profile-control',
    'title',
    'description',
    'provenance',
    'close',
    'side',
    'overlay',
    'difference',
    'slider',
    'slider-label',
    'zoom-controls',
    'zoom',
    'zoom-title',
    'zoom-position',
    'zoom-images',
    'zoom-prev',
    'zoom-next',
    'coverage',
    'empty-state',
    'empty-kicker',
    'empty-title',
    'empty-message',
    'empty-status',
    'empty-retry',
    'screen-filters',
    'dashboard-filters',
    'filters-row',
    'date-filter',
    'date-prev',
    'date-strip',
    'date-next',
    'versions',
    'screens',
    'screen-load-more',
    'footer',
    'auth-preview',
    'auth-gate',
    'google-sign-in',
]

class Element {
    constructor(id) {
        this.id = id
        this.children = []
        this.hidden = false
        this.open = false
        this.parentElement = { hidden: false }
        this.value = ''
        this.checked = false
        this.textContent = ''
        this.className = ''
        this.dataset = {}
        this.style = {}
        this.listeners = new Map()
        this.clientWidth = 280
        this.scrollWidth = 0
        this.scrollLeft = 0
        this.lastScrollOptions = null
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener)
    }
    dispatch(type, event = {}) {
        this.listeners.get(type)?.({ target: this, preventDefault() {}, ...event })
    }
    append(...children) {
        this.children.push(...children)
    }
    replaceChildren(...children) {
        this.children = children
        if (this.id === 'date-strip') this.scrollWidth = children.length * 70
    }
    setAttribute(name, value) {
        this[name] = value
    }
    showModal() {
        this.open = true
    }
    close() {
        this.open = false
    }
    scrollBy(options) {
        this.lastScrollOptions = options
        const { left } = options
        this.scrollLeft = Math.max(0, Math.min(this.scrollLeft + left, this.scrollWidth - this.clientWidth))
        this.dispatch('scroll')
    }
}

const versionGroups = (elements) => elements.get('versions').children
const versionLinks = (elements) => versionGroups(elements).flatMap((group) => group.children[1]?.children ?? [])
const imageSources = (element) => [element?.src, ...(element?.children ?? []).flatMap(imageSources)].filter(Boolean)
const elementText = (element) => [element?.textContent, ...(element?.children ?? []).flatMap(elementText)].join(' ')

async function loadLanding(
    pathname,
    { ok = true, redirected = false, index = [], report, comparisonReport, search = '', hash = '' } = {}
) {
    const elements = new Map(elementIds.map((id) => [id, new Element(id)]))
    const brand = new Element('brand')
    const location = {
        pathname,
        protocol: 'https:',
        search,
        hash,
        href: '',
        reload() {},
    }
    const historyCalls = []
    const history = {
        replaceState(_state, _title, href) {
            historyCalls.push(href)
            const next = new URL(href, 'https://screens.example')
            location.pathname = next.pathname
            location.search = next.search
            location.hash = next.hash
        },
    }
    elements.location = location
    elements.historyCalls = historyCalls
    let resolveResponse
    const response = new Promise((resolve) => {
        resolveResponse = resolve
    })
    const document = {
        createElement: () => new Element(),
        getElementById: (id) => elements.get(id),
        querySelector: (selector) => (selector === '.brand' ? brand : null),
    }
    elements.document = document
    const context = vm.createContext({
        console,
        document,
        URLSearchParams,
        fetch: (url) =>
            url.endsWith('/index.json')
                ? Promise.resolve({ ok: true, status: 200, json: async () => index })
                : comparisonReport && url.includes('/screen-data/reports/')
                  ? Promise.resolve({ ok: true, status: 200, json: async () => comparisonReport })
                  : response,
        history,
        location,
        window: {},
    })
    vm.runInContext(viewer, context, {
        filename: 'public/screen-library/viewer.js',
    })
    resolveResponse({
        ok: ok && !redirected,
        type: redirected ? 'opaqueredirect' : undefined,
        status: redirected ? 0 : ok ? 200 : 404,
        json: async () => report ?? index,
    })
    await new Promise((resolve) => setImmediate(resolve))
    return elements
}

const sha = 'a'.repeat(40)
const run = (name, overrides = {}) => ({
    path: `2026-10-12/${name}/en/${sha}`,
    date: '2026-10-12',
    locale: 'en',
    source: 'synthetic',
    branch: 'main',
    changedScreens: 0,
    complete: true,
    reportType: 'comparison',
    profile: '393x852',
    ...overrides,
})
const positivePr = run('pr-41', { prNumber: 41, changedScreens: 2 })
const zeroPr = run('pr-42', { prNumber: 42 })
const baseline = run('main', {
    branch: 'main',
    reportType: 'capture',
    changedScreens: 0,
})
const catalogue = [positivePr, zeroPr, baseline]
const linkedPaths = (elements) =>
    versionLinks(elements)
        .map((link) => link.href ?? '')
        .filter(Boolean)
const hasPath = (links, entry) => links.some((href) => href.includes(entry.path))
const setUpdatesOnly = (elements, checked) => {
    const control = elements.get('screen-updates-only')
    control.checked = checked
    control.dispatch('change')
}

test('A1: native labelled switch appears after Locale and starts enabled', async () => {
    const html = readFileSync(new URL('../../public/screen-library/index.html', import.meta.url), 'utf8')
    const input = html.match(/<input\b[^>]*\bid=["']screen-updates-only["'][^>]*>/i)?.[0]
    assert.ok(input, 'Screen updates only must be a native input')
    assert.match(input, /\btype=["']checkbox["']/i)
    assert.match(input, /\brole=["']switch["']/i)
    assert.doesNotMatch(input, /\btabindex=["']-1["']/i)
    assert.match(
        html,
        /<label\b[^>]*\bfor=["']screen-updates-only["'][^>]*>[\s\S]*?Screen updates only[\s\S]*?<\/label>/i
    )
    assert.ok(html.indexOf('id="locale"') < html.indexOf('id="screen-updates-only"'))
    const elements = await loadLanding('/screens/', { index: catalogue })
    assert.equal(elements.get('screen-updates-only').checked, true)
    assert.equal(elements.get('screen-updates-control').hidden, false)
})

test('A2: default gallery hides confirmed-zero PRs and retains positive PRs and baselines', async () => {
    const elements = await loadLanding('/screens/', { index: catalogue })
    const links = linkedPaths(elements)
    assert.ok(hasPath(links, positivePr), 'positive-count PR remains')
    assert.ok(!hasPath(links, zeroPr), 'confirmed-zero PR is hidden')
    assert.ok(hasPath(links, baseline), 'baseline run remains')
})

test('A3: switching off restores zero PRs and repeated events are deterministic', async () => {
    const elements = await loadLanding('/screens/', { index: catalogue })
    const initial = linkedPaths(elements)
    assert.ok(!hasPath(initial, zeroPr), 'test starts from the default filtered state')
    setUpdatesOnly(elements, false)
    const all = linkedPaths(elements)
    assert.ok(hasPath(all, zeroPr))
    assert.ok(hasPath(all, positivePr))
    assert.ok(hasPath(all, baseline))
    setUpdatesOnly(elements, false)
    assert.deepEqual(linkedPaths(elements), all, 'duplicate off event is idempotent')
    setUpdatesOnly(elements, true)
    assert.deepEqual(linkedPaths(elements), initial, 'on restores the first catalogue')
    setUpdatesOnly(elements, false)
    assert.deepEqual(linkedPaths(elements), all, 'second off yields the same order and membership')
})

test('A4: off preference round trips through the URL; invalid values default on', async () => {
    const elements = await loadLanding('/screens/', {
        index: catalogue,
        search: '?source=synthetic&locale=en',
        hash: '#gallery',
    })
    setUpdatesOnly(elements, false)
    assert.ok(hasPath(linkedPaths(elements), zeroPr))
    const url = new URL(elements.historyCalls.at(-1), 'https://screens.example')
    assert.equal(url.searchParams.get('updates'), 'all')
    assert.equal(url.searchParams.get('source'), 'synthetic')
    assert.equal(url.searchParams.get('locale'), 'en')
    assert.equal(url.hash, '#gallery')

    const restored = await loadLanding('/screens/', { index: catalogue, search: url.search })
    assert.equal(restored.get('screen-updates-only').checked, false)
    assert.ok(hasPath(linkedPaths(restored), zeroPr))

    const invalid = await loadLanding('/screens/', { index: catalogue, search: '?updates=bogus' })
    assert.equal(invalid.get('screen-updates-only').checked, true)
    assert.ok(!hasPath(linkedPaths(invalid), zeroPr))

    setUpdatesOnly(restored, true)
    assert.equal(new URL(restored.historyCalls.at(-1), 'https://screens.example').searchParams.has('updates'), false)
})

test('A3: off choice composes with branch, locale and date without resetting them', async () => {
    const datedZero = run('pr-50', {
        path: `2026-10-11/pr-50/pt/${sha}`,
        date: '2026-10-11',
        locale: 'pt',
        branch: 'dev',
        prNumber: 50,
    })
    const elements = await loadLanding('/screens/', {
        index: [...catalogue, datedZero],
        search: '?branch=dev&locale=pt&date=2026-10-11',
    })
    const before = {
        branch: elements.get('branch').value,
        locale: elements.get('locale').value,
        date: new URLSearchParams(elements.location.search).get('date'),
    }
    assert.equal(before.branch, 'dev')
    assert.ok(!hasPath(linkedPaths(elements), datedZero))
    setUpdatesOnly(elements, false)
    assert.ok(hasPath(linkedPaths(elements), datedZero))
    assert.equal(elements.get('branch').value, before.branch)
    assert.equal(elements.get('locale').value, before.locale)
    assert.equal(new URLSearchParams(elements.location.search).get('date'), before.date)
    setUpdatesOnly(elements, true)
    assert.ok(!hasPath(linkedPaths(elements), datedZero))
})

test('A4: report links carry the off preference while reports keep their own screen content', async () => {
    const elements = await loadLanding('/screens/', { index: catalogue })
    setUpdatesOnly(elements, false)
    const link = versionLinks(elements).find((item) => item.href?.includes(zeroPr.path))
    assert.ok(link, 'zero-change report is restored')
    const reportUrl = new URL(link.href, 'https://screens.example')
    assert.equal(reportUrl.searchParams.get('updates'), 'all')
    const report = await loadLanding(reportUrl.pathname, {
        search: reportUrl.search,
        index: catalogue,
        report: {
            schema: 1,
            type: 'comparison',
            locale: 'en',
            complete: true,
            before: { width: 393, height: 852 },
            after: { width: 393, height: 852 },
            screens: [
                {
                    id: 'login',
                    flow: 'Authentication',
                    kind: 'screen',
                    status: 'changed',
                    percent: 0.1,
                    before: { image: `${'a'.repeat(64)}.png` },
                    after: { image: `${'a'.repeat(64)}.png` },
                },
            ],
        },
    })
    assert.equal(report.get('screen-updates-control').hidden, true)
    assert.ok(report.get('screens').children.length > 0, 'report screen remains visible')
})

test('A5: a filtered-empty gallery reports zero and retains usable date and locale choices', async () => {
    const elements = await loadLanding('/screens/', { index: [zeroPr] })
    assert.equal(elements.get('screen-updates-only').checked, true)
    assert.equal(elements.get('empty-state').hidden, true, 'published captures still exist')
    assert.match(elements.get('coverage').textContent, /^0 published\b/i)
    assert.ok(elements.get('date-strip').children.length > 0, 'date remains selectable')
    assert.ok(elements.get('locale').children.length > 0, 'locale remains selectable')
    assert.match(elementText(elements.get('versions')), /screen updates|filter|match/i)
    setUpdatesOnly(elements, false)
    assert.ok(hasPath(linkedPaths(elements), zeroPr), 'switching off recovers the entry')
})

test('A5: switch is hidden on report pages and Nutcracker journey gallery', async () => {
    const report = await loadLanding(`/screens/${zeroPr.path}/`, {
        report: {
            schema: 1,
            type: 'comparison',
            locale: 'en',
            complete: true,
            before: { width: 393, height: 852 },
            after: { width: 393, height: 852 },
            screens: [],
        },
    })
    assert.equal(report.get('screen-updates-control').hidden, true)

    const journeys = await loadLanding('/screens/', {
        search: '?source=nutcracker',
        index: [
            run('nutcracker', {
                path: `2026-10-12/nutcracker/en/${sha}`,
                source: 'nutcracker',
                reportType: 'journeys',
                branch: 'main',
            }),
        ],
    })
    assert.equal(journeys.get('screen-updates-control').hidden, true)
})

test('A6: only confirmed zero screen counts hide PR entries', async (t) => {
    const cases = [
        { name: 'positive one', count: 1, visible: true },
        { name: 'positive maximum safe integer', count: Number.MAX_SAFE_INTEGER, visible: true },
        { name: 'confirmed zero', count: 0, visible: false },
        { name: 'missing count', missing: true, visible: true },
        { name: 'null count', count: null, visible: true },
        { name: 'string zero', count: '0', visible: true },
        { name: 'negative count', count: -1, visible: true },
        { name: 'fractional count', count: 0.5, visible: true },
        { name: 'NaN count', count: Number.NaN, visible: true },
        { name: 'Infinity count', count: Number.POSITIVE_INFINITY, visible: true },
        { name: 'unsafe integer count', count: Number.MAX_SAFE_INTEGER + 1, visible: true },
        { name: 'legacy PR path without PR number or count', missing: true, legacy: true, visible: true },
    ]
    for (const [index, sample] of cases.entries()) {
        await t.test(sample.name, async () => {
            const entry = run(`pr-${70 + index}`, {
                prNumber: 70 + index,
                changedScreens: sample.count,
            })
            if (sample.missing) delete entry.changedScreens
            if (sample.legacy) delete entry.prNumber
            const elements = await loadLanding('/screens/', { index: [entry] })
            assert.equal(elements.get('screen-updates-only').checked, true)
            assert.equal(
                hasPath(linkedPaths(elements), entry),
                sample.visible,
                `${sample.name} must ${sample.visible ? 'remain visible' : 'be hidden'}`
            )
        })
    }
})
