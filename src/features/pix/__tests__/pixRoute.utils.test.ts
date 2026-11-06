import { findPixRoute, pixRefusalCopy, pixScreen } from '../pixRoute.utils'
import { pixDepositCodeUrl } from '../pix.routes'
import type { CapabilityRoute } from '@/types/capabilities'
import { DEMO_USER } from '@/constants/demo-data'

const route = (overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
    ...overrides,
})

describe('findPixRoute', () => {
    it("picks the operation's PIX_BR route", () => {
        const withdraw = route({ operation: 'withdraw', provider: 'manteca' })
        expect(findPixRoute([route({ method: 'SPEI_MX' }), withdraw, route()], 'withdraw')).toBe(withdraw)
        expect(findPixRoute(undefined, 'deposit')).toBeUndefined()
    })
})

describe('pixScreen', () => {
    it("mounts the screens of the provider the route names, whatever the user's step", () => {
        expect(pixScreen(route(), false)).toBe('avenia')
        expect(pixScreen(route({ state: 'action_required', action: 'activate' }), false)).toBe('avenia')
        expect(pixScreen(route({ provider: 'manteca', candidates: [] }), false)).toBe('manteca')
    })

    it("shows a refused route as not available, never its candidates' screens", () => {
        const refused = (provider: 'avenia' | 'manteca') =>
            route({ provider: null, state: 'refused', candidates: [{ provider, state: 'refused' }] })
        expect(pixScreen(refused('avenia'), false)).toBe('unavailable')
        expect(pixScreen(refused('manteca'), false)).toBe('unavailable')
    })

    it('shows the outage screen for a paused route, and waits while capabilities load', () => {
        expect(pixScreen(route({ state: 'paused' }), false)).toBe('paused')
        expect(pixScreen(route(), true)).toBe('loading')
        expect(pixScreen(undefined, false)).toBe('unavailable')
    })
})

describe('pixDepositCodeUrl', () => {
    it("opens one deposit's code on the neutral page", () => {
        expect(pixDepositCodeUrl('d 1')).toBe('/add-money/pix?step=showQR&intentId=d+1')
    })
})

describe('pixRefusalCopy', () => {
    const reason = (code: string, userMessage = 'From the API.') => ({ code, userMessage })

    it("localizes the reasons this build knows, and shows the route's own text for the rest", () => {
        expect(pixRefusalCopy(reason('provider_rejected'))).toBe('rejected')
        expect(pixRefusalCopy(reason('provider_setup_failed'))).toBe('setup-failed')
        expect(pixRefusalCopy(reason('residence_not_served'))).toBe('residence')
        expect(pixRefusalCopy(reason('rollout_closed'))).toBe('not-yet')
        expect(pixRefusalCopy(reason('provider_unavailable'))).toBe('down')
        expect(pixRefusalCopy(reason('provider_paused'))).toBe('down')
        expect(pixRefusalCopy(reason('method_not_served'))).toBe('not-served')
        expect(pixRefusalCopy(reason('manteca_us_nationality'))).toBe('reason')
        expect(pixRefusalCopy(reason('manteca_us_nationality', ''))).toBe('not-served')
        expect(pixRefusalCopy(undefined)).toBe('not-served')
    })
})

describe('demo mode', () => {
    it('reaches the Avenia Pix screens for both operations', () => {
        for (const operation of ['deposit', 'withdraw'] as const) {
            expect(pixScreen(findPixRoute(DEMO_USER.capabilities?.routes, operation), false)).toBe('avenia')
        }
    })
})
