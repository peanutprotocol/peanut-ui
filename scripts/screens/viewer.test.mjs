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

async function loadLanding(pathname) {
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
        location: { pathname, protocol: 'https:' },
        window: {},
    })
    vm.runInContext(viewer, context, { filename: 'public/screen-library/viewer.js' })
    resolveResponse({
        ok: true,
        json: async () => [
            { path: '2026-09-11/dev-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', date: '2026-09-11', label: 'dev' },
        ],
    })
    await new Promise((resolve) => setImmediate(resolve))
    return elements
}

test('landing catalogue hides controls and route coverage on the root URL and deployed alias', async () => {
    for (const pathname of ['/', '/screen-library/index.html']) {
        const elements = await loadLanding(pathname)
        assert.equal(elements.get('screen-filters').hidden, true, pathname)
        assert.equal(elements.get('route-coverage').hidden, true, pathname)
        assert.equal(elements.get('versions').children.length, 1, pathname)
        assert.equal(elements.get('screens').children.length, 0, pathname)
    }
})
