import { renderHook } from '@testing-library/react'
import { DEMO_USER } from '@/constants/demo-data'
import { DEV_TOOLS_ENABLED } from '@/constants/dev-tools.consts'
import { otherWaysRows } from '@/features/deposit-accounts/hubRows'
import { useBankRows } from '@/hooks/useBankRows'
import { FIXTURES } from '@/dev/fixtures/registry'
import { featureReport } from '@/dev/fixtures/featureReport'
import { fixtureRespond } from '@/dev/fixtures/respond'
import type { Fixture } from '@/dev/fixtures/types'
import type { IdentityVerification, UserCapabilities } from '@/types/capabilities'

const mockDemoRespond = jest.fn()
let mockCapabilities: UserCapabilities
let mockAuthUser: unknown

jest.mock('@/constants/dev-tools.consts', () => ({ DEV_TOOLS_ENABLED: true }))
jest.mock('@/utils/demo-api', () => ({ demoRespond: (...args: unknown[]) => mockDemoRespond(...args) }))
jest.mock('@/app/actions/clients', () => ({}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: mockCapabilities, nextActions: mockCapabilities.nextActions }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockAuthUser }) }))
jest.mock('@/utils/native-platform', () => ({ useHydrationSnapshot: () => null }))

class TestResponse {
    status: number
    constructor(
        private body: unknown,
        init?: { status?: number }
    ) {
        this.status = init?.status ?? 200
    }
    headers = { get: () => 'application/json' }
    get ok() {
        return this.status >= 200 && this.status < 300
    }
    json() {
        return Promise.resolve(typeof this.body === 'string' ? JSON.parse(this.body) : this.body)
    }
}

const originalResponse = global.Response

beforeAll(() => {
    global.Response = TestResponse as unknown as typeof Response
})

afterAll(() => {
    global.Response = originalResponse
})

beforeEach(() => {
    window.history.replaceState({}, '', '/')
    window.sessionStorage.clear()
    mockCapabilities = DEMO_USER.capabilities as UserCapabilities
    mockAuthUser = undefined
    mockDemoRespond.mockResolvedValue(new TestResponse(DEMO_USER))
})

afterEach(() => {
    delete FIXTURES['test-report-synthesis']
    delete FIXTURES['test-duplicate-email']
    delete FIXTURES['test-explicit-report']
    window.sessionStorage.clear()
    window.history.replaceState({}, '', '/')
})

function activateFixture(name: string) {
    window.history.replaceState({}, '', `/profile/accounts?__fixture=${name}`)
    window.sessionStorage.setItem('peanut_fixture', name)
}

function addFixture(name: string, fixture: Fixture) {
    FIXTURES[name] = fixture
    activateFixture(name)
}

describe('fixtureRespond capability report', () => {
    it.each(['get-paid-usd-closed-bangladesh', 'get-paid-usd-closed-bangladesh-claim'])(
        '%s carries the paperwork USD refusal into its synthesized report',
        async (name) => {
            activateFixture(name)
            const body = await (await fixtureRespond('/users/me')).json()
            const paperwork = await (await fixtureRespond('/users/kyc/paperwork')).json()
            expect(paperwork.products).toContainEqual(
                expect.objectContaining({ product: 'bridge.usd', available: false })
            )
            expect(body.capabilities.features.bank.accounts.USD).toMatchObject({ state: 'refused' })
            expect(body.capabilities.features.bank.accounts.EUR.state).toBe('action_required')
            expect(body.capabilities.features.bank.accounts.GBP.state).toBe('action_required')
            expect(body.capabilities.features.bank.accounts.MXN.state).toBe('action_required')
        }
    )

    it.each(['qr-pay-identity-missing', 'qr-pay-identity-restart-pending', 'qr-pay-identity-document-missing'])(
        '%s exposes an explicit resolved identity restart and a matching QR action',
        async (name) => {
            activateFixture(name)
            const body = await (await fixtureRespond('/users/me')).json()
            expect(body.capabilities.features.qr).toMatchObject({
                state: 'action_required',
                action: 'restart-identity',
            })
            const qr = body.capabilities.rails.find((rail: { id: string }) => rail.id === 'manteca.pix_br')
            expect(qr.resolved).toMatchObject({
                status: 'fixable',
                blocking: { selfHealable: true, selfHealKind: 'restart-identity' },
                nextAction: { kind: 'restart-identity' },
            })
        }
    )

    it('preserves capability restriction metadata in report synthesis', async () => {
        const restriction = {
            code: 'manteca_us_nationality',
            affectedRailIds: ['manteca.pix_br'],
            userMessage: 'This identity cannot use this provider.',
        }
        addFixture('test-report-synthesis', {
            route: '/profile/accounts',
            about: 'Synthetic restricted identity metadata fixture',
            responses: {
                'GET /users/me': {
                    capabilities: { rails: [], nextActions: [], restrictions: [restriction] },
                    identityVerification: { status: 'verified' },
                    residence: { declared: 'BR', verified: null },
                },
            },
        })
        const body = await (await fixtureRespond('/users/me')).json()
        expect(body.capabilities.restrictions).toEqual([restriction])
        expect(body.capabilities.features.local.accounts.BRL).toMatchObject({ state: 'refused' })
    })

    it.each(['withdraw-brazil-paused'])(
        '%s supplies the Brazil residence used by the pause and capability report',
        async (name) => {
            activateFixture(name)
            const body = await (await fixtureRespond('/users/me')).json()

            expect(body.residence.verified.country).toBe('BR')
            expect(body.residence.secondaryDeclaredCountry).toBeNull()
            expect(body.capabilities.features).toEqual(
                featureReport({
                    rails: body.capabilities.rails,
                    nextActions: body.capabilities.nextActions,
                    identity: body.identityVerification,
                    residence: 'BR',
                })
            )
            // the router pauses the pay route; the app reads the route, not the switch
            expect(body.capabilities.routes).toEqual([expect.objectContaining({ operation: 'pay', state: 'paused' })])
        }
    )

    it('builds a report from merged rails, actions, identity refusal and verified residence', async () => {
        expect(DEMO_USER.capabilities!.features).toBeDefined()
        const fixture: Fixture = {
            route: '/profile/accounts',
            about: 'Synthetic report synthesis acceptance fixture',
            responses: {
                'GET /users/me': {
                    capabilities: {
                        rails: [
                            {
                                id: 'bridge.ach_us',
                                provider: 'bridge',
                                method: 'ACH_US',
                                channel: 'bank',
                                country: 'US',
                                currency: 'USD',
                                status: 'enabled',
                            },
                        ],
                        nextActions: [{ key: 'identity:review', kind: 'wait', purpose: 'identity-review' }],
                    },
                    identityVerification: {
                        status: 'failed',
                        reason: { code: 'document_rejected', userMessage: 'Synthetic refusal' },
                        rejectLabels: ['proof_of_address'],
                    },
                    residence: { declared: { country: 'PT' }, verified: { country: 'AR' } },
                },
            },
        }
        addFixture('test-report-synthesis', fixture)

        const response = await fixtureRespond('/users/me')
        const body = (await response.json()) as {
            capabilities: UserCapabilities
            identityVerification: IdentityVerification
        }
        const expected = featureReport({
            rails: body.capabilities.rails,
            nextActions: body.capabilities.nextActions,
            identity: body.identityVerification,
            residence: 'AR',
        })

        expect(body.capabilities.features).toEqual(expected)
        expect(body.capabilities.features).not.toEqual(DEMO_USER.capabilities!.features)
    })

    it('forwards duplicate-email rejection labels when no rail is enabled', async () => {
        addFixture('test-duplicate-email', {
            route: '/profile/accounts',
            about: 'Synthetic duplicate-email acceptance fixture',
            responses: {
                'GET /users/me': {
                    capabilities: { rails: [], nextActions: [] },
                    identityVerification: {
                        status: 'action_required',
                        reason: { code: 'identity_document_insufficient', userMessage: 'Synthetic identity action' },
                        rejectLabels: ['DUPLICATE_EMAIL'],
                    },
                    residence: { declared: { country: 'PT' }, verified: null },
                },
            },
        })

        const response = await fixtureRespond('/users/me')
        const body = (await response.json()) as { capabilities: UserCapabilities }

        expect(body.capabilities.features?.bank?.accounts.USD).toMatchObject({
            state: 'refused',
            reason: 'duplicate_account',
        })
    })

    it('rebuilds the merged report even when the fixture has no users/me override', async () => {
        addFixture('test-report-synthesis', { route: '/profile/accounts', about: 'Synthetic baseline-only fixture' })
        mockDemoRespond.mockResolvedValue(
            new TestResponse({
                ...DEMO_USER,
                capabilities: { ...DEMO_USER.capabilities, rails: [], nextActions: [] },
                identityVerification: { status: 'not_started' },
                residence: null,
            })
        )

        const response = await fixtureRespond('/users/me')
        const body = (await response.json()) as { capabilities: UserCapabilities }

        expect(body.capabilities.features?.bank.accounts.USD).toEqual({ state: 'action_required', action: 'verify' })
    })

    // the demo user lives in Brazil: its routes must not answer for a fixture that describes another user
    it("keeps the demo's Brazil routes out of a fixture with its own capability block, unless it states routes", async () => {
        addFixture('test-report-synthesis', {
            route: '/profile/accounts',
            about: 'Own capabilities, no routes',
            responses: { 'GET /users/me': { capabilities: { rails: [], nextActions: [], restrictions: [] } } },
        })
        expect(
            ((await (await fixtureRespond('/users/me')).json()) as { capabilities: UserCapabilities }).capabilities
                .routes
        ).toEqual([])

        activateFixture('pix-manteca-withdraw-review')
        const manteca = (await (await fixtureRespond('/users/me')).json()) as { capabilities: UserCapabilities }
        expect(manteca.capabilities.routes?.map((route) => route.provider)).toEqual(['manteca', 'manteca', 'manteca'])

        activateFixture('pix-deposit-amount')
        const avenia = (await (await fixtureRespond('/users/me')).json()) as { capabilities: UserCapabilities }
        expect(avenia.capabilities.routes?.[0]).toMatchObject({ provider: 'avenia', limits: { minAmount: '20' } })
    })

    it('answers a signed-out fixture with its null user instead of building a report', async () => {
        activateFixture('guest-invite')

        const response = await fixtureRespond('/users/me')

        expect(await response.json()).toBeNull()
    })

    it('preserves an explicit fixture report instead of synthesizing over it', async () => {
        const explicitReport = {
            qr: { state: 'pending' },
            local: { state: 'on', accounts: { BRL: { state: 'on' }, ARS: { state: 'on' } } },
            bank: {
                state: 'on',
                accounts: {
                    EUR: { state: 'on' },
                    GBP: { state: 'on' },
                    MXN: { state: 'on' },
                    USD: { state: 'pending' },
                },
            },
            card: { state: 'on' },
        }
        addFixture('test-explicit-report', {
            route: '/profile/accounts',
            about: 'Synthetic explicit report acceptance fixture',
            responses: { 'GET /users/me': { capabilities: { features: explicitReport } } },
        })

        const response = await fixtureRespond('/users/me')
        const body = (await response.json()) as { capabilities: UserCapabilities }

        expect(body.capabilities.features?.qr?.state).toBe('pending')
        expect(body.capabilities.features?.bank).toEqual(explicitReport.bank)
    })

    it('feeds the active profile accounts fixture into the bank rows and keeps USD after answered-open filtering', async () => {
        expect(DEV_TOOLS_ENABLED).toBe(true)
        expect(FIXTURES['profile-accounts'].route).toBe('/profile/accounts')
        activateFixture('profile-accounts')

        const response = await fixtureRespond('/users/me')
        const body = (await response.json()) as {
            user: Record<string, unknown>
            residence?: Record<string, unknown>
            capabilities: UserCapabilities
        }
        mockCapabilities = body.capabilities
        mockAuthUser = { user: body.user, residence: body.residence }

        const { result } = renderHook(() => useBankRows())
        const usd = result.current.rows.find((row) => row.labelKey === 'usd')
        const otherWays = otherWaysRows(result.current.rows, new Set(['EUR']), new Set(['ACH_US']))

        expect(body.capabilities.features?.bank?.accounts.USD).toEqual({ state: 'on' })
        expect(usd).toMatchObject({ chip: 'active' })
        expect(otherWays.some((row) => row.labelKey === 'usd')).toBe(true)
    })
})
