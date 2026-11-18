import {
    findPixRoute,
    pixDepositOffered,
    pixKeySend,
    pixPayBlock,
    pixRefusalCopy,
    pixResidencePaused,
    pixRouteGate,
    pixRouteOpen,
    pixRouteReportEntry,
    pixScreen,
    withPixRoute,
} from '../pixRoute.utils'
import { pixDepositCodeUrl } from '../pix.routes'
import type { CapabilityRoute } from '@/types/capabilities'
import { LOCAL_SERVED_ELSEWHERE_REASON } from '@/features/kyc-features/report'
import { DEMO_USER } from '@/constants/demo-data'

const route = (overrides: Partial<CapabilityRoute> = {}): CapabilityRoute => ({
    operation: 'deposit',
    method: 'PIX_BR',
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
    ...overrides,
})

it.each(['residence_unresolved', 'residence_address_in_review'])(
    'preserves a local address blocker over a ready Pix route: %s',
    (reason) => {
        const report = DEMO_USER.capabilities!.features!
        const entry = { state: 'setting_up' as const, reason }
        const blocked = { ...report, local: { ...entry, accounts: { BRL: entry } } }
        expect(withPixRoute(blocked, [route()]).local.accounts.BRL).toEqual(entry)
    }
)

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
        expect(pixScreen(route({ provider: 'manteca', candidates: [] }), false)).toBe('flow')
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

describe('pixRouteOpen', () => {
    it('is open for a route the API sent and did not refuse, paused included', () => {
        expect(pixRouteOpen(route())).toBe(true)
        expect(pixRouteOpen(route({ state: 'action_required', action: 'activate' }))).toBe(true)
        expect(pixRouteOpen(route({ state: 'pending' }))).toBe(true)
        expect(pixRouteOpen(route({ state: 'paused' }))).toBe(true)
        expect(pixRouteOpen(route({ provider: null, state: 'paused' }))).toBe(true)
    })

    it('is closed without a route, and for a refused one', () => {
        expect(pixRouteOpen(undefined)).toBe(false)
        expect(pixRouteOpen(route({ provider: null, state: 'refused' }))).toBe(false)
    })
})

describe('pixDepositOffered', () => {
    const residencePaused = { code: 'residence_paused', userMessage: '' }
    const manteca = (overrides: Partial<CapabilityRoute> = {}) =>
        route({ provider: 'manteca', candidates: [{ provider: 'manteca', state: 'ready' }], ...overrides })

    it('offers Pix on Home on a route on Avenia, whatever the step: active, setting up, under review', () => {
        expect(pixDepositOffered(route())).toBe(true)
        expect(pixDepositOffered(route({ state: 'action_required', action: 'verify' }))).toBe(true)
        expect(pixDepositOffered(route({ state: 'action_required', action: 'activate' }))).toBe(true)
        expect(pixDepositOffered(route({ state: 'pending' }))).toBe(true)
    })

    it('keeps the row through an outage of Avenia: the Pix page shows the outage', () => {
        const outage = { code: 'provider_paused', userMessage: '' }
        expect(pixDepositOffered(route({ state: 'paused', reason: outage }))).toBe(true)
    })

    // Aleks, 2026-11-14: every user outside Brazil has a Manteca route; Pix on Home is for Avenia's users
    it('offers no Pix on a Manteca route, whatever its step', () => {
        expect(pixDepositOffered(manteca())).toBe(false)
        expect(pixDepositOffered(manteca({ state: 'action_required', action: 'activate' }))).toBe(false)
        expect(pixDepositOffered(manteca({ state: 'pending' }))).toBe(false)
        expect(pixDepositOffered(manteca({ state: 'paused' }))).toBe(false)
    })

    it('offers no Pix under the Brazil pause, with no provider or with Avenia inside its rollout', () => {
        expect(pixDepositOffered(route({ provider: null, state: 'paused', reason: residencePaused }))).toBe(false)
        expect(pixDepositOffered(route({ state: 'paused', reason: residencePaused }))).toBe(false)
    })

    it('offers no Pix without a route, nor for a refused one', () => {
        expect(pixDepositOffered(undefined)).toBe(false)
        expect(pixDepositOffered(route({ provider: null, state: 'refused' }))).toBe(false)
    })
})

describe('pixResidencePaused', () => {
    it('reads the Brazil pause by its reason, whatever provider the route names', () => {
        const reason = { code: 'residence_paused', userMessage: '' }
        expect(pixResidencePaused(route({ provider: null, state: 'paused', reason }))).toBe(true)
        expect(pixResidencePaused(route({ state: 'paused', reason }))).toBe(true)
    })

    it("is not a provider's outage, nor any route that is not paused", () => {
        const outage = { code: 'provider_paused', userMessage: '' }
        expect(pixResidencePaused(route({ state: 'paused', reason: outage }))).toBe(false)
        expect(pixResidencePaused(route())).toBe(false)
        expect(pixResidencePaused(undefined)).toBe(false)
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
    it('reaches the Avenia Pix screens for both operations', () => {
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

    // TASK-24947 M5: Manteca's BRL switched off pauses the route for everyone, residents of Brazil or not
    it('a provider paused for everyone is an outage, not the pause of Brazil’s residents', () => {
        expect(pixPayBlock(pay({ state: 'paused', reason: { code: 'provider_paused', userMessage: '' } }))).toBe(
            'outage'
        )
        expect(pixPayBlock(pay({ state: 'paused' }))).toBe('outage')
    })

    it('reads the pay route, not the deposit or withdraw route', () => {
        const routes = [route({ state: 'paused' }), pay({ state: 'ready' })]
        expect(pixPayBlock(findPixRoute(routes, 'pay'))).toBeNull()
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

    // the API's answer for a resident of Brazil: the local feature refused because the Pix route serves them
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

// TASK-24947: a withdraw route on Avenia pays any key, resident of Brazil or not
describe('pixKeySend', () => {
    const withdraw = (provider: CapabilityRoute['provider'], state: CapabilityRoute['state']) => ({ provider, state })

    it.each([
        ['a resident of Brazil, whose pay route refuses the residence', 'residence' as const],
        ['a non-resident, whose pay route is open', null],
        ['anyone under the Brazil pause', 'paused' as const],
    ])('sends through the withdraw route on Avenia for %s', (_who, payBlock) => {
        expect(pixKeySend(payBlock, withdraw('avenia', 'ready'))).toEqual({ via: 'withdraw', block: null })
        // still being set up: the Pix page takes the user through it
        expect(pixKeySend(payBlock, withdraw('avenia', 'action_required'))).toEqual({ via: 'withdraw', block: null })
    })

    it("keeps the pay route and its block for Manteca's withdraw route, a refused route, or none", () => {
        expect(pixKeySend(null, withdraw('manteca', 'ready'))).toEqual({ via: 'pay', block: null })
        expect(pixKeySend('residence', withdraw('avenia', 'refused'))).toEqual({ via: 'pay', block: 'residence' })
        expect(pixKeySend('paused', undefined)).toEqual({ via: 'pay', block: 'paused' })
    })
})
