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
    'route-coverage',
    'route-inventory',
    'versions',
    'screens',
    'download',
    'footer',
]

class Element {
    constructor(id) {
        this.id = id
        this.children = []
        this.hidden = false
        this.open = false
        this.parentElement = { hidden: false }
        this.value = ''
        this.textContent = ''
        this.className = ''
        this.listeners = new Map()
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
    }
    setAttribute(name, value) {
        this[name] = value
    }
}

async function loadLanding(pathname, { ok = true, index = [], report } = {}) {
    const elements = new Map(elementIds.map((id) => [id, new Element(id)]))
    const brand = new Element('brand')
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
        fetch: () => response,
        location: { pathname, protocol: 'https:', search: '', hash: '', reload() {} },
        window: {},
    })
    vm.runInContext(viewer, context, { filename: 'public/screen-library/viewer.js' })
    resolveResponse({ ok, status: ok ? 200 : 404, json: async () => report ?? index })
    await new Promise((resolve) => setImmediate(resolve))
    return elements
}

test('landing catalogue hides controls and route coverage on the root URL and deployed alias', async () => {
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
        assert.equal(elements.get('route-coverage').hidden, true, pathname)
        assert.equal(elements.get('versions').children.length, 1, pathname)
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
    assert.equal(elements.get('versions').children.length, 1)
    elements.get('locale').value = 'es-419'
    elements.get('locale').dispatch('change')
    assert.equal(elements.get('versions').children.length, 1)
    assert.match(elements.get('versions').children[0].textContent, /Español/)
})

test('comparison reports can switch from changed screens to the full catalogue', async () => {
    const image = 'a'.repeat(64) + '.png'
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
        ],
    }
    const elements = await loadLanding('/screens/2026-09-11/pr-1/en/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa/', {
        report,
    })
    assert.equal(elements.get('view-mode').value, 'changed')
    assert.equal(elements.get('screens').children.length, 1)
    elements.get('view-mode').value = 'all'
    elements.get('view-mode').dispatch('change')
    assert.equal(elements.get('screens').children.length, 2)
    assert.equal(elements.get('screens').children[0].children[1].className, 'pair single')
})

test('landing page shows a friendly empty state when captures are not published', async () => {
    for (const options of [{ index: [] }, { ok: false }]) {
        const elements = await loadLanding('/', options)
        assert.equal(elements.get('empty-state').hidden, false)
        assert.match(elements.get('empty-title').textContent, /almost here/i)
        assert.equal(elements.get('coverage').hidden, true)
        assert.equal(elements.get('screen-filters').hidden, true)
        assert.equal(elements.get('route-coverage').hidden, true)
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
