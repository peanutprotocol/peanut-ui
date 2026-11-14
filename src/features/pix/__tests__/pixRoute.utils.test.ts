import {
    findPixRoute,
    pixKeySaveOffered,
    pixPayBlock,
    pixRefusalCopy,
    pixRouteGate,
    pixRouteOpen,
    pixRouteReportEntry,
    pixPlanSetUp,
    pixScreen,
    withPixRoute,
} from '../pixRoute.utils'
import { pixDepositCodeUrl } from '../pix.routes'
import type { CapabilityRoute, NextAction } from '@/types/capabilities'
import { LOCAL_SERVED_ELSEWHERE_REASON } from '@/features/kyc-features/report'
import { DEMO_USER } from '@/constants/demo-data'

const route = (overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'manteca',
    state: 'ready',
    candidates: [{ provider: 'manteca', state: 'ready' }],
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
    it("mounts the one Pix flow for whichever provider the route names, whatever the user's step", () => {
        expect(pixScreen(route(), false)).toBe('flow')
        expect(pixScreen(route({ state: 'action_required', action: 'activate' }), false)).toBe('flow')
        expect(pixScreen(route({ candidates: [] }), false)).toBe('flow')
    })

    it("shows a refused route as not available, never its candidates' screens", () => {
        const refused = route({
            provider: null,
            state: 'refused',
            candidates: [{ provider: 'manteca', state: 'refused' }],
        })
        expect(pixScreen(refused, false)).toBe('unavailable')
        expect(pixScreen(route({ provider: null, state: 'refused', candidates: [] }), false)).toBe('unavailable')
    })

    it('shows the outage screen for a paused route, and waits while capabilities load', () => {
        expect(pixScreen(route({ state: 'paused' }), false)).toBe('paused')
        expect(pixScreen(route(), true)).toBe('loading')
        expect(pixScreen(undefined, false)).toBe('unavailable')
    })
})

describe('pixRouteOpen', () => {
    it('offers Pix on Home for a deposit route the API sent and did not refuse, paused included', () => {
        expect(pixRouteOpen(route())).toBe(true)
        expect(pixRouteOpen(route({ state: 'action_required', action: 'activate' }))).toBe(true)
        expect(pixRouteOpen(route({ state: 'pending' }))).toBe(true)
        // the Pix page shows the outage itself
        expect(pixRouteOpen(route({ state: 'paused' }))).toBe(true)
    })

    it('offers no Pix without a route, nor for a refused one', () => {
        expect(pixRouteOpen(undefined)).toBe(false)
        expect(pixRouteOpen(route({ provider: null, state: 'refused' }))).toBe(false)
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
        expect(pixRefusalCopy(reason('method_not_served'))).toBe('not-served')
        expect(pixRefusalCopy(reason('manteca_us_nationality'))).toBe('reason')
        expect(pixRefusalCopy(reason('manteca_us_nationality', ''))).toBe('not-served')
        expect(pixRefusalCopy(undefined)).toBe('not-served')
    })
})

describe('demo mode', () => {
    it('reaches the Pix screens for both operations', () => {
        for (const operation of ['deposit', 'withdraw'] as const) {
            expect(pixScreen(findPixRoute(DEMO_USER.capabilities?.routes, operation), false)).toBe('flow')
        }
    })
})

describe('pixPayBlock', () => {
    const pay = (overrides: Partial<CapabilityRoute>) => route({ operation: 'pay', provider: 'manteca', ...overrides })

    it('stops a Pix payment only for the pause or a residence the pay route does not serve', () => {
        expect(pixPayBlock(pay({ state: 'paused', reason: { code: 'residence_paused', userMessage: '' } }))).toBe(
            'paused'
        )
        expect(
            pixPayBlock(
                pay({ provider: null, state: 'refused', reason: { code: 'residence_not_served', userMessage: '' } })
            )
        ).toBe('residence')
        // other refusals are the payment's own gates (identity, rollout), not this block
        expect(
            pixPayBlock(pay({ provider: null, state: 'refused', reason: { code: 'rollout_closed', userMessage: '' } }))
        ).toBeNull()
        expect(pixPayBlock(pay({ state: 'ready' }))).toBeNull()
        // an API with no pay route lets the payment's own gates decide
        expect(pixPayBlock(undefined)).toBeNull()
    })

    it('reads the pay route, not the deposit or withdraw route', () => {
        const routes = [route({ state: 'paused' }), pay({ state: 'ready' })]
        expect(pixPayBlock(findPixRoute(routes, 'pay'))).toBeNull()
    })
})

describe('pixKeySaveOffered', () => {
    it('offers "Save to favorites" on a Manteca route and on one that names no provider, never on Bridge', () => {
        expect(pixKeySaveOffered(route({ operation: 'withdraw', provider: 'manteca' }))).toBe(true)
        expect(pixKeySaveOffered(route({ operation: 'withdraw', provider: null }))).toBe(true)
        expect(pixKeySaveOffered(route({ operation: 'withdraw', provider: 'bridge' }))).toBe(false)
    })
})

describe('the BRL account from the Pix route', () => {
    const report = {
        qr: { state: 'on' as const },
        card: { state: 'ready' as const },
        bank: { state: 'on' as const, accounts: { USD: { state: 'on' as const } } },
        local: {
            state: 'refused' as const,
            reason: 'local_residence_unsupported',
            accounts: { BRL: { state: 'refused' as const, reason: 'local_residence_unsupported' } },
        },
    }

    it('reads each route state as the account entry the account screens know', () => {
        expect(pixRouteReportEntry(route())).toEqual({ state: 'on' })
        expect(pixRouteReportEntry(route({ state: 'action_required', action: 'verify' }))).toMatchObject({
            state: 'action_required',
            action: 'verify',
        })
        expect(pixRouteReportEntry(route({ state: 'action_required', action: 'activate' }))).toMatchObject({
            state: 'ready',
            action: 'activate',
        })
        expect(pixRouteReportEntry(route({ state: 'paused' }))).toMatchObject({ state: 'pending' })
        expect(
            pixRouteReportEntry(route({ state: 'refused', reason: { code: 'provider_rejected', userMessage: '' } }))
        ).toEqual({ state: 'refused', reason: 'provider_rejected' })
    })

    it('lays the deposit route over the BRL account only, and only when the API sends one', () => {
        const routed = withPixRoute(report, [route()])
        expect(routed.local.accounts.BRL).toEqual({ state: 'on' })
        expect(routed.local.state).toBe('refused')
        expect(routed.bank).toBe(report.bank)
        expect(withPixRoute(report, [route({ operation: 'pay' })])).toBe(report)
        expect(withPixRoute(report, undefined)).toBe(report)
    })

    // the local feature refused because another entry serves the residence's Pix
    it('reads the BRL account from the route whichever residence answer refused the local feature', () => {
        const servedElsewhere = {
            ...report,
            local: {
                state: 'refused' as const,
                reason: LOCAL_SERVED_ELSEWHERE_REASON,
                accounts: { BRL: { state: 'refused' as const, reason: LOCAL_SERVED_ELSEWHERE_REASON } },
            },
        }
        expect(withPixRoute(servedElsewhere, [route()]).local.accounts.BRL).toEqual({ state: 'on' })
        expect(
            withPixRoute(servedElsewhere, [route({ state: 'action_required', action: 'activate' })]).local.accounts.BRL
        ).toMatchObject({ state: 'ready', action: 'activate' })
    })

    // TASK-24910: Bridge takes our verification, so its route asks for our check first and its own steps after it
    it("keeps Home's Set up Pix row on our Verify for a provider whose first step is our identity check", () => {
        const bridge = (overrides: Partial<CapabilityRoute>) =>
            route({ provider: 'bridge', candidates: [{ provider: 'bridge', state: 'action_required' }], ...overrides })
        const terms: NextAction[] = [{ key: 'accept-tos', kind: 'accept-tos', purpose: 'accept-bridge-tos' }]
        expect(pixPlanSetUp('brlBank', false, bridge({ state: 'action_required', action: 'verify' }), [])).toBeNull()
        // Bridge's terms come after our check, so a user our check verified never reads them as the provider's step
        expect(pixPlanSetUp('brlBank', true, bridge({ state: 'action_required', action: 'accept-tos' }), terms)).toBe(
            null
        )
        expect(pixPlanSetUp('brlBank', false, bridge({ state: 'action_required', action: 'accept-tos' }), terms)).toBe(
            null
        )
        expect(pixPlanSetUp('brlBank', false, bridge({ state: 'pending' }), [])).toBe('done')
    })

    it('gates the Pix corridor by the route', () => {
        expect(pixRouteGate(route())).toEqual({ kind: 'ready' })
        expect(pixRouteGate(route({ state: 'action_required', action: 'verify' }))).toEqual({ kind: 'needs-identity' })
        expect(pixRouteGate(route({ state: 'action_required', action: 'activate' }))).toEqual({
            kind: 'needs-enrollment',
        })
        expect(pixRouteGate(route({ state: 'pending' })).kind).toBe('waiting-on-provider')
        expect(pixRouteGate(route({ state: 'refused' })).kind).toBe('blocked-rejection')
    })
})
