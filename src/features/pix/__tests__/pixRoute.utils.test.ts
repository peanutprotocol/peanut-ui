import { findPixRoute, pixScreen } from '../pixRoute.utils'
import { pixDepositCodeUrl } from '../pix.routes'
import type { CapabilityRoute } from '@/types/capabilities'

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

    it("lets a refused route's best candidate explain the refusal", () => {
        const refused = (provider: 'avenia' | 'manteca') =>
            route({ provider: null, state: 'refused', candidates: [{ provider, state: 'refused' }] })
        expect(pixScreen(refused('avenia'), false)).toBe('avenia')
        expect(pixScreen(refused('manteca'), false)).toBe('manteca')
        expect(pixScreen(route({ provider: null, state: 'refused', candidates: [] }), false)).toBe('unavailable')
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
