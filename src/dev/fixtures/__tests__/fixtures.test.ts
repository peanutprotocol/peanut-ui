import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { FIXTURES } from '@/dev/fixtures/registry'

const names = Object.keys(FIXTURES)

const APP_DIR = join(process.cwd(), 'src', 'app', '(mobile-ui)')

// A dynamic segment is a real route: /limits/manteca is served by limits/[provider].
// A fixture route may carry a query string (deep-linked flow steps) — only the
// pathname resolves against the filesystem.
function routeExists(route: string): boolean {
    let dir = APP_DIR
    const pathname = route.split('?')[0]
    for (const segment of pathname.split('/').filter(Boolean)) {
        if (existsSync(join(dir, segment))) {
            dir = join(dir, segment)
            continue
        }
        const dynamic = readdirSync(dir).find((entry) => entry.startsWith('['))
        if (!dynamic) return false
        dir = join(dir, dynamic)
    }
    return existsSync(join(dir, 'page.tsx'))
}

describe('fixture registry', () => {
    it('has unique kebab-case names', () => {
        expect(new Set(names).size).toBe(names.length)
        for (const name of names) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    })

    // A fixture whose route was renamed or deleted opens a 404 and looks like the
    // fixture is broken. The name also becomes a screenshot filename, so a stale
    // route quietly rots a screenshot job.
    it('points every fixture at a route that exists', () => {
        for (const [name, fixture] of Object.entries(FIXTURES)) {
            expect(routeExists(fixture.route) ? fixture.route : `${name} → missing ${fixture.route}`).toBe(
                fixture.route
            )
        }
    })
})

// The whole system hangs off one build-time constant. If that gate ever stops
// holding, a production build ships fake API answers to real users.
describe('production gate', () => {
    beforeEach(() => {
        jest.resetModules()
        window.history.replaceState({}, '', '/?__fixture=home')
        window.sessionStorage.setItem('peanut_fixture', 'home')
    })

    afterEach(() => {
        window.sessionStorage.clear()
        window.history.replaceState({}, '', '/')
    })

    it('reports no fixture when dev tools are disabled', () => {
        jest.doMock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: false }))
        const { ensureActiveFixture } = require('@/dev/fixtures/active')
        expect(ensureActiveFixture()).toBeNull()
    })

    it('reports the fixture when dev tools are enabled', () => {
        jest.doMock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: true }))
        const { ensureActiveFixture } = require('@/dev/fixtures/active')
        expect(ensureActiveFixture()).toBe('home')
    })
})
