import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { FIXTURES } from '@/dev/fixtures/registry'

const names = Object.keys(FIXTURES)

const APP_DIR = join(process.cwd(), 'src', 'app', '(mobile-ui)')

// A dynamic segment is a real route: /limits/manteca is served by limits/[provider].
// A fixture route may carry a query string (deep-linked flow steps) — only the
// pathname resolves against the filesystem.
function routeExists(route: string): boolean {
    const pathname = new URL(route, 'http://fixture.local').pathname
    if (['', '(setup)'].some((group) => existsSync(join(process.cwd(), 'src', 'app', group, pathname, 'page.tsx'))))
        return true
    let dir = APP_DIR
    // a fixture may open a route with its own query (nuqs URL state)
    for (const segment of new URL(route, 'http://fixture.local').pathname.split('/').filter(Boolean)) {
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
    it('shows the USD corridor task alongside Home actions', () => {
        expect(FIXTURES['home-verification-needed'].responses?.['GET /users/me']).toEqual(
            expect.objectContaining({
                capabilities: expect.objectContaining({
                    nextActions: [expect.objectContaining({ key: 'bridge-hosted:proof-of-address', currency: 'USD' })],
                }),
            })
        )
    })

    // api#1816: an identity approved with bank accounts ticked parks Bridge until
    // the proof of address arrives on its own supplement action.
    it('parks a Bridge rail on its proof-of-address supplement', () => {
        const me = FIXTURES['bank-proof-of-address-supplement'].responses?.['GET /users/me'] as {
            capabilities: { rails: Array<Record<string, unknown>>; nextActions: Array<Record<string, unknown>> }
        }
        expect(me.capabilities.rails[0]).toEqual(
            expect.objectContaining({
                provider: 'bridge',
                status: 'blocked',
                reason: expect.objectContaining({ code: 'requirements_missing' }),
                blockingActions: ['supplement:bridge'],
            })
        )
        expect(me.capabilities.nextActions).toEqual([expect.objectContaining({ key: 'supplement:bridge' })])
    })

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
