import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import vm from 'node:vm'

const viewer = readFileSync(new URL('../../public/screen-library/viewer.js', import.meta.url), 'utf8')
const elementIds = [
    'search',
    'flow',
    'status',
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
    'route-coverage',
    'route-inventory',
    'versions',
    'screens',
    'download',
]

class Element {
    constructor(id) {
        this.id = id
        this.children = []
        this.hidden = false
        this.open = false
        this.parentElement = { hidden: false }
        this.value = ''
    }

    addEventListener() {}
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

async function loadLanding(pathname, { ok = true, index = [] } = {}) {
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
        fetch: () => response,
        location: { pathname, protocol: 'https:', reload() {} },
        window: {},
    })
    vm.runInContext(viewer, context, { filename: 'public/screen-library/viewer.js' })
    resolveResponse({ ok, status: ok ? 200 : 404, json: async () => index })
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
        assert.equal(elements.get('route-coverage').hidden, true, pathname)
        assert.equal(elements.get('versions').children.length, 1, pathname)
        assert.equal(elements.get('screens').children.length, 0, pathname)
    }
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
