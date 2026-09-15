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
    'source',
    'source-control',
    'locale',
    'title',
    'description',
    'provenance',
    'close',
    'side',
    'overlay',
    'difference',
    'slider',
    'slider-label',
    'zoom',
    'zoom-title',
    'zoom-images',
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
        this.listeners = new Map()
        this.clientWidth = 280
        this.scrollWidth = 0
        this.scrollLeft = 0
    }

    addEventListener(type, listener) {
        this.listeners.set(type, listener)
    }
    dispatch(type) {
        this.listeners.get(type)?.({ target: this })
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
    scrollBy({ left }) {
        this.scrollLeft = Math.max(0, Math.min(this.scrollLeft + left, this.scrollWidth - this.clientWidth))
        this.dispatch('scroll')
    }
}

const versionGroups = (elements) => elements.get('versions').children
const versionLinks = (elements) => versionGroups(elements).flatMap((group) => group.children[1]?.children ?? [])

async function loadLanding(pathname, { ok = true, index = [], report, search = '', hash = '' } = {}) {
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
    const context = vm.createContext({
        console,
        document,
        URLSearchParams,
        fetch: (url) =>
            url.endsWith('/index.json')
                ? Promise.resolve({ ok: true, status: 200, json: async () => index })
                : response,
        history,
        location,
        window: {},
    })
    vm.runInContext(viewer, context, {
        filename: 'public/screen-library/viewer.js',
    })
    resolveResponse({
        ok,
        status: ok ? 200 : 404,
        json: async () => report ?? index,
    })
    await new Promise((resolve) => setImmediate(resolve))
    return elements
}

test('root shows the branded sign-in gate when Access redirects the catalogue request', async () => {
    const elements = new Map(elementIds.map((id) => [id, new Element(id)]))
    const brand = new Element('brand')
    const body = {
        classList: {
            add(value) {
                this.value = value
            },
        },
    }
    const document = {
        body,
        createElement: () => new Element(),
        getElementById: (id) => elements.get(id),
        querySelector: (selector) => (selector === '.brand' ? brand : null),
    }
    const context = vm.createContext({
        console,
        document,
        URLSearchParams,
        fetch: async () => ({ type: 'opaqueredirect', status: 0 }),
        location: {
            pathname: '/',
            protocol: 'https:',
            search: '',
            hash: '',
            href: '',
            reload() {},
        },
        window: {},
    })
    vm.runInContext(viewer, context, {
        filename: 'public/screen-library/viewer.js',
    })
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(elements.get('auth-gate').hidden, false)
    assert.equal(elements.get('auth-preview').hidden, false)
    assert.equal(elements.get('coverage').textContent, 'Private product library')
    assert.equal(body.classList.value, 'auth-required')
})

test('landing catalogue hides screen controls on the root URL and deployed alias', async () => {
    for (const pathname of ['/', '/screen-library/index.html']) {
        const elements = await loadLanding(pathname, {
            index: [
                {
                    path: '2026-09-11/dev-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                    date: '2026-09-11',
                    label: 'dev',
                },
            ],
        })
        assert.equal(elements.get('screen-filters').hidden, true, pathname)
        assert.equal(elements.get('dashboard-filters').hidden, false, pathname)
        assert.equal(elements.get('source-control').hidden, true, pathname)
        assert.equal(elements.get('date-filter').hidden, false, pathname)
        assert.equal(versionGroups(elements).length, 1, pathname)
        assert.equal(versionLinks(elements).length, 1, pathname)
        assert.equal(elements.get('screens').children.length, 0, pathname)
    }
})

test('landing locale selector filters published versions', async () => {
    const elements = await loadLanding('/', {
        index: [
            {
                path: '2026-09-11/pr-1/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                date: '2026-09-11',
                label: 'English',
                locale: 'en',
            },
            {
                path: '2026-09-11/pr-1/es-419/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                date: '2026-09-11',
                label: 'Español',
                locale: 'es-419',
            },
        ],
    })
    assert.equal(elements.get('locale').children.length, 2)
    assert.equal(elements.get('locale').value, 'en')
    assert.equal(elements.get('locale').children[0].textContent, 'EN')
    assert.equal(elements.get('locale').children[1].textContent, 'ES-419')
    assert.equal(versionLinks(elements).length, 1)
    elements.get('locale').value = 'es-419'
    elements.get('locale').dispatch('change')
    assert.equal(versionLinks(elements).length, 1)
    assert.equal(versionLinks(elements)[0].children[1].textContent, 'pr-1')
    assert.equal(elements.location.search, '?source=synthetic&locale=es-419')
})

test('landing source selector restores and shares deterministic or real journey filters', async () => {
    const syntheticPath = '2026-09-14/dev/en/' + 'a'.repeat(40)
    const nutcrackerPath = '2026-09-14/nutcracker/en/' + 'b'.repeat(40)
    const elements = await loadLanding('/', {
        search: '?source=nutcracker&locale=en',
        index: [
            { path: syntheticPath, date: '2026-09-14', label: 'dev', locale: 'en', source: 'synthetic' },
            {
                path: nutcrackerPath,
                date: '2026-09-14',
                label: 'Nutcracker',
                locale: 'en',
                source: 'nutcracker',
            },
        ],
    })
    assert.equal(elements.get('source').children.length, 2)
    assert.equal(elements.get('source-control').hidden, false)
    assert.equal(elements.get('source').value, 'nutcracker')
    assert.equal(versionLinks(elements)[0].href, `/screens/${nutcrackerPath}/?source=nutcracker&locale=en`)
    assert.match(elements.get('title').textContent, /Real backend journeys/)
    elements.get('source').value = 'synthetic'
    elements.get('source').dispatch('change')
    assert.equal(versionLinks(elements).length, 1)
    assert.equal(versionLinks(elements)[0].href, `/screens/${syntheticPath}/?source=synthetic&locale=en`)
    assert.equal(elements.location.search, '?source=synthetic&locale=en')
})

test('landing groups versions by date and exposes a shareable horizontal date filter', async () => {
    const latest = '2026-09-14'
    const older = '2026-09-12'
    const index = [
        {
            path: `${latest}/pr-2/en/${'b'.repeat(40)}`,
            date: latest,
            label: 'PR 2',
            locale: 'en',
            reportType: 'comparison',
            branch: 'fix/card-entry-feature-list-ds',
            prNumber: 2,
            changedScreens: 4,
        },
        { path: `${latest}/dev/en/${'a'.repeat(40)}`, date: latest, label: 'Dev', locale: 'en' },
        { path: `${older}/pr-1/en/${'c'.repeat(40)}`, date: older, label: 'PR 1', locale: 'en' },
    ]
    const elements = await loadLanding('/', {
        index,
    })
    assert.equal(versionGroups(elements).length, 2)
    assert.equal(versionGroups(elements)[0].children[0].textContent, 'September 14, 2026')
    assert.equal(versionGroups(elements)[0].children[1].children.length, 2)
    assert.equal(versionGroups(elements)[1].children[0].textContent, 'September 12, 2026')
    const latestCard = versionLinks(elements)[0]
    assert.equal(latestCard.children[0].children[0].textContent, 'September 14, 2026')
    assert.equal(latestCard.children[0].children[1].textContent, 'Changed screens')
    assert.equal(latestCard.children[1].textContent, 'fix/card-entry-feature-list-ds')
    assert.equal(latestCard.children[2].children[0].textContent, 'PR #2')
    assert.equal(latestCard.children[3].children[0].textContent, '4')
    assert.equal(latestCard.children[3].children[1].textContent, 'screens changed')

    const dateButtons = elements.get('date-strip').children
    const latestButton = dateButtons.find((button) => button['aria-label'] === 'Show captures from September 14, 2026')
    const gapButton = dateButtons.find((button) => button['aria-label'] === 'September 13, 2026 — no captures')
    assert.equal(
        dateButtons.some((button) => button['aria-label'] === 'September 11, 2026 — no captures'),
        false
    )
    assert.deepEqual(
        latestButton.children.map((child) => child.textContent),
        ['14', 'Sep']
    )
    assert.equal(gapButton.disabled, true)
    assert.match(gapButton.className, /unavailable/)
    latestButton.onclick()
    assert.equal(versionGroups(elements).length, 1)
    assert.equal(versionLinks(elements).length, 2)
    assert.equal(elements.location.search, '?source=synthetic&locale=en&date=2026-09-14')
    assert.match(elements.get('coverage').textContent, /on September 14, 2026/)

    const restored = await loadLanding('/', {
        search: '?source=synthetic&locale=en&date=2026-09-12',
        index,
    })
    assert.equal(versionGroups(restored).length, 1)
    assert.equal(versionGroups(restored)[0].children[0].textContent, 'September 12, 2026')
    restored.get('date-strip').children[0].onclick()
    assert.equal(versionGroups(restored).length, 2)
    assert.equal(restored.location.search, '?source=synthetic&locale=en')
})

test('date navigator pages without exposing a native scrollbar', async () => {
    const elements = await loadLanding('/', {
        index: [
            { path: `2026-09-15/dev/en/${'a'.repeat(40)}`, date: '2026-09-15', locale: 'en' },
            { path: `2026-09-12/dev/en/${'b'.repeat(40)}`, date: '2026-09-12', locale: 'en' },
        ],
    })
    assert.equal(elements.get('date-strip').children.length, 5)
    assert.equal(elements.get('date-prev').hidden, true)
    assert.equal(elements.get('date-next').hidden, false)
    elements.get('date-next').onclick()
    assert.equal(elements.get('date-prev').hidden, false)
    assert.equal(elements.get('date-next').hidden, true)
    elements.get('date-prev').onclick()
    assert.equal(elements.get('date-prev').hidden, true)
    assert.equal(elements.get('date-next').hidden, false)
})

test('changed mode shows only visual changes and can switch to the full catalogue', async () => {
    const image = 'a'.repeat(64) + '.png'
    const visualChange = (id, status) => ({
        id,
        name: `${status} screen`,
        flow: 'Home',
        kind: 'route',
        status,
        before: status === 'added' ? { status: 'absent', reason: 'Not in baseline' } : { status: 'captured', image },
        after: status === 'removed' ? { status: 'absent', reason: 'Not in revision' } : { status: 'captured', image },
    })
    const captureGap = (id, status) => ({
        id,
        name: `${status} screen`,
        flow: 'Home',
        kind: 'route',
        status,
        before: { status, reason: 'No comparable screenshot' },
        after: { status, reason: 'No comparable screenshot' },
    })
    const report = {
        schema: 1,
        type: 'comparison',
        locale: 'en',
        complete: true,
        before: {
            commit: 'a'.repeat(40),
            capturedAt: 'now',
            environment: 'test',
            contentCommit: 'a',
            harness: 'a',
            fixtures: 'a',
        },
        after: {
            commit: 'b'.repeat(40),
            capturedAt: 'now',
            environment: 'test',
            contentCommit: 'b',
            harness: 'b',
            fixtures: 'b',
        },
        screens: [
            {
                id: 'changed',
                name: 'Changed screen',
                flow: 'Home',
                kind: 'route',
                status: 'changed',
                before: { status: 'captured', image, thumbnail: image },
                after: { status: 'captured', image, thumbnail: image },
            },
            {
                id: 'unchanged',
                name: 'Unchanged screen',
                flow: 'Home',
                kind: 'route',
                status: 'unchanged',
                before: { status: 'captured', image, thumbnail: image },
                after: { status: 'captured', image, thumbnail: image },
            },
            visualChange('added', 'added'),
            visualChange('removed', 'removed'),
            captureGap('failed', 'failed'),
            captureGap('unavailable', 'unavailable'),
            captureGap('excluded', 'excluded'),
            captureGap('absent', 'absent'),
        ],
        previewUrls: {
            [image]: `https://imagedelivery.net/3RfIxQn88kFXdTrxhfIMXw/ps-${'a'.repeat(29)}/screenpreview`,
        },
        originalUrls: {
            [image]: `https://imagedelivery.net/3RfIxQn88kFXdTrxhfIMXw/ps-${'a'.repeat(29)}/public`,
        },
    }
    const elements = await loadLanding('/screens/2026-09-11/pr-1/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/', {
        report,
    })
    assert.equal(elements.get('view-mode').checked, false)
    assert.deepEqual(
        elements.get('screens').children.map(({ id }) => id),
        ['changed', 'added', 'removed']
    )
    elements.get('screens').children[0].children[1].children[0].children[1].onclick()
    assert.equal(elements.get('zoom-images').children[0].src, `/screen-data/assets/${image}`)
    elements.get('view-mode').checked = true
    elements.get('view-mode').dispatch('change')
    assert.equal(elements.get('screens').children.length, 8)
    assert.equal(elements.get('screens').children[0].children[1].className, 'pair single')
})

test('report filters restore from and continuously update the shareable URL', async () => {
    const image = 'a'.repeat(64) + '.png'
    const path = '2026-09-11/pr-1/en/' + 'b'.repeat(40)
    const report = {
        schema: 1,
        type: 'comparison',
        locale: 'en',
        complete: true,
        before: { commit: 'a'.repeat(40), capturedAt: 'now', environment: 'test' },
        after: { commit: 'b'.repeat(40), capturedAt: 'now', environment: 'test' },
        screens: [
            {
                id: 'changed',
                name: 'Changed screen',
                flow: 'Home',
                kind: 'route',
                status: 'changed',
                before: { status: 'captured', image, thumbnail: image },
                after: { status: 'captured', image, thumbnail: image },
            },
            {
                id: 'unchanged',
                name: 'Unchanged screen',
                flow: 'Home',
                kind: 'route',
                status: 'unchanged',
                before: { status: 'captured', image, thumbnail: image },
                after: { status: 'captured', image, thumbnail: image },
            },
        ],
    }
    const elements = await loadLanding(`/screens/${path}/`, {
        index: [{ path, locale: 'en', source: 'synthetic' }],
        report,
        search: '?source=synthetic&locale=en&q=changed&flow=Home&status=changed&view=all',
    })
    assert.equal(elements.get('search').value, 'changed')
    assert.equal(elements.get('flow').value, 'Home')
    assert.equal(elements.get('status').value, 'changed')
    assert.equal(elements.get('view-mode').checked, true)
    assert.equal(elements.get('screens').children.length, 1)

    elements.get('search').value = 'Changed screen'
    elements.get('search').dispatch('input')
    assert.equal(
        elements.location.search,
        '?source=synthetic&locale=en&q=Changed+screen&flow=Home&status=changed&view=all'
    )
})

test('report navigation drops status filters that belong to a different source', async () => {
    const image = 'a'.repeat(64) + '.png'
    const thumbnail = 'b'.repeat(64) + '.webp'
    const journeyPath = '2026-09-14/nutcracker/en/' + 'c'.repeat(40)
    const syntheticPath = '2026-09-14/dev/en/' + 'd'.repeat(40)
    const report = {
        schema: 1,
        type: 'journeys',
        source: 'nutcracker',
        commit: 'c'.repeat(40),
        uiCommit: 'd'.repeat(40),
        apiCommit: 'e'.repeat(40),
        locale: 'en',
        environment: 'sandbox',
        capturedAt: '2026-09-14T08:00:00Z',
        profile: 'en-iphone-14',
        width: 390,
        height: 664,
        complete: true,
        screens: [
            {
                id: 'send-success',
                name: 'Send success',
                flow: 'e2e-send',
                kind: 'route',
                route: '/send/success',
                trustTier: 'full-e2e',
                status: 'passed',
                image,
                thumbnail,
            },
        ],
    }
    const elements = await loadLanding(`/screens/${journeyPath}/`, {
        index: [
            { path: journeyPath, locale: 'en', source: 'nutcracker' },
            { path: syntheticPath, locale: 'en', source: 'synthetic' },
        ],
        report,
        search: '?source=nutcracker&locale=en&status=passed',
    })
    assert.equal(elements.get('status').value, 'passed')
    elements.get('source').value = 'synthetic'
    elements.get('source').dispatch('change')
    assert.equal(elements.location.href, `/screens/${syntheticPath}/?source=synthetic&locale=en`)
})

test('reports discard status filters that do not exist in their rows', async () => {
    const image = 'a'.repeat(64) + '.png'
    const report = {
        schema: 1,
        type: 'capture',
        locale: 'en',
        complete: true,
        capturedAt: '2026-09-14T08:00:00Z',
        screens: [
            {
                id: 'home',
                name: 'Home',
                flow: 'Home',
                kind: 'route',
                status: 'captured',
                image,
                thumbnail: image,
            },
        ],
    }
    const elements = await loadLanding('/screens/2026-09-14/dev/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/', {
        report,
        search: '?source=synthetic&locale=en&status=passed',
    })
    assert.equal(elements.get('status').value, '')
    assert.equal(elements.get('screens').children.length, 1)
    assert.equal(elements.location.search, '?source=synthetic&locale=en')
})

test('screen lists load the first page and leave the next page for scroll loading', async () => {
    const image = 'a'.repeat(64) + '.png'
    const report = {
        schema: 1,
        type: 'capture',
        locale: 'en',
        complete: true,
        capturedAt: '2026-09-09T18:00:00Z',
        screens: Array.from({ length: 25 }, (_, index) => ({
            id: `screen-${index}`,
            name: `Screen ${index}`,
            flow: 'Home',
            kind: 'route',
            status: 'captured',
            image,
            thumbnail: image,
        })),
    }
    const elements = await loadLanding('/screens/2026-09-11/pr-1/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/', {
        report,
    })
    assert.equal(elements.get('screens').children.length, 24)
    assert.equal(elements.get('screen-load-more').hidden, false)
})

test('new reports use Access-protected same-origin screenshot URLs', async () => {
    const image = 'a'.repeat(64) + '.png'
    const report = {
        schema: 1,
        type: 'capture',
        locale: 'en',
        complete: true,
        capturedAt: '2026-09-09T18:00:00Z',
        screens: [
            {
                id: 'home',
                name: 'Home',
                flow: 'Home',
                kind: 'route',
                status: 'captured',
                image,
                thumbnail: image,
            },
        ],
    }
    const elements = await loadLanding('/screens/2026-09-11/dev/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/', {
        report,
    })
    const screenshot = elements.get('screens').children[0].children[1].children[0].children[1].children[0]
    assert.equal(screenshot.src, `/screen-data/assets/${image}`)
})

test('Nutcracker reports show real-backend provenance and retain a screenshot when its assertion failed', async () => {
    const original = 'a'.repeat(64) + '.png'
    const thumbnail = 'b'.repeat(64) + '.webp'
    const commit = 'c'.repeat(40)
    const report = {
        schema: 1,
        type: 'journeys',
        source: 'nutcracker',
        commit,
        uiCommit: 'd'.repeat(40),
        apiCommit: 'e'.repeat(40),
        locale: 'en',
        environment: 'sandbox',
        capturedAt: '2026-09-14T08:00:00Z',
        profile: 'en-iphone-14',
        width: 390,
        height: 664,
        complete: false,
        screens: [
            {
                id: 'send-success',
                name: 'Send success',
                flow: 'e2e-send',
                kind: 'route',
                route: '/send/success',
                trustTier: 'full-e2e',
                status: 'failed',
                reason: 'Journey assertion failed',
                image: original,
                thumbnail,
            },
        ],
    }
    const path = `2026-09-14/nutcracker/en/${commit}/run-123-1`
    const elements = await loadLanding(`/screens/${path}/`, {
        index: [{ path, locale: 'en', source: 'nutcracker' }],
        report,
    })
    assert.equal(elements.get('view-mode-row').hidden, true)
    assert.match(elements.get('coverage').textContent, /Incomplete Nutcracker run/)
    assert.match(elements.get('footer').textContent, /Nutcracker sandbox backend/)
    assert.match(elements.get('provenance').children[0].children[0].textContent, /Nutcracker/)
    const screenshot = elements.get('screens').children[0].children[1].children[0].children[1].children[0]
    assert.equal(screenshot.src, `/screen-data/assets/${thumbnail}`)
})

test('report pages expose the locale selector and use a long-form capture date', async () => {
    const report = {
        schema: 1,
        type: 'capture',
        locale: 'en',
        complete: true,
        capturedAt: '2026-09-09T18:00:00Z',
        screens: [],
    }
    const elements = await loadLanding('/screens/2026-09-11/pr-1/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/', {
        index: [
            {
                path: '2026-09-11/pr-1/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                locale: 'en',
            },
            {
                path: '2026-09-11/pr-1/es-419/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
                locale: 'es-419',
            },
        ],
        report,
    })
    assert.equal(elements.get('dashboard-filters').hidden, false)
    assert.equal(elements.get('view-mode-row').hidden, true)
    assert.equal(elements.get('locale').children.length, 2)
    assert.equal(elements.get('locale').value, 'en')
    assert.equal(elements.get('description').children[0].textContent, 'September 9, 2026')
    elements.get('locale').value = 'es-419'
    elements.get('locale').dispatch('change')
    assert.equal(elements.get('locale').value, 'es-419')
})

test('landing page shows a friendly empty state when captures are not published', async () => {
    for (const options of [{ index: [] }, { ok: false }]) {
        const elements = await loadLanding('/', options)
        assert.equal(elements.get('empty-state').hidden, false)
        assert.match(elements.get('empty-title').textContent, /almost here/i)
        assert.equal(elements.get('coverage').hidden, true)
        assert.equal(elements.get('screen-filters').hidden, true)
        assert.equal(elements.get('filters-row').hidden, true)
    }
})

test('hosted report 404 shows a report-not-found state instead of an unpublished catalogue', async () => {
    const elements = await loadLanding('/screens/2026-09-11/dev-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/', {
        ok: false,
    })
    assert.equal(elements.get('empty-state').hidden, false)
    assert.match(elements.get('empty-title').textContent, /report is not available/i)
    assert.doesNotMatch(elements.get('empty-title').textContent, /almost here/i)
    assert.match(elements.get('empty-message').textContent, /published report/i)
})
