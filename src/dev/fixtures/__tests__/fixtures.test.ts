import { existsSync } from 'fs'
import { join } from 'path'
import { FIXTURES } from '@/dev/fixtures/registry'

const names = Object.keys(FIXTURES)

describe('fixture registry', () => {
    it('has unique kebab-case names', () => {
        expect(new Set(names).size).toBe(names.length)
        for (const name of names) expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    })

    // A fixture whose route was renamed or deleted opens a 404 and looks like the
    // fixture is broken. The name also becomes a screenshot filename, so a stale
    // route quietly rots a screenshot job.
    it('points every fixture at a route that exists', () => {
        const appDir = join(process.cwd(), 'src', 'app', '(mobile-ui)')
        for (const [name, fixture] of Object.entries(FIXTURES)) {
            const page = join(appDir, fixture.route, 'page.tsx')
            expect(existsSync(page) ? fixture.route : `${name} → missing ${fixture.route}`).toBe(fixture.route)
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
