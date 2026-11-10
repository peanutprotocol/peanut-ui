import {
    findPixRoute,
    pixHostedVerification,
    pixPayBlock,
    pixRefusalCopy,
    pixRouteGate,
    pixRouteReportEntry,
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
    provider: 'avenia',
    state: 'ready',
    candidates: [{ provider: 'avenia', state: 'ready' }],
    ...overrides,
})

// the provider takes no shared verification: its own identity check, on its page
describe("the provider's own identity check", () => {
    const hosted: NextAction = {
        key: 'avenia-hosted',
        kind: 'avenia-hosted',
        purpose: 'avenia-identity',
        url: 'https://avenia.example/identity/u1',
        expiresAt: '2099-01-01T00:00:00.000Z',
    }
    const terms: NextAction = { key: 'accept-tos:avenia', kind: 'accept-tos', purpose: 'unlock-avenia' }
    const step = (action: string) => route({ state: 'action_required', action })

    it('is the hosted action the route names, or offers while its step reads verify', () => {
        expect(pixHostedVerification(step('avenia-hosted'), [terms, hosted])).toBe(hosted)
        expect(pixHostedVerification(step('verify'), [hosted])).toBe(hosted)
        // the Peanut check, the terms, or no step at all are not it
        expect(pixHostedVerification(step('verify'), [terms])).toBeUndefined()
        expect(pixHostedVerification(step('accept-tos:avenia'), [terms, hosted])).toBeUndefined()
        expect(pixHostedVerification(route({ state: 'pending' }), [hosted])).toBeUndefined()
    })

    it('reads as a set-up step on the Accounts row and its gate, like the terms', () => {
        expect(pixRouteReportEntry(step('verify'), [hosted])).toEqual({ state: 'ready', action: 'avenia-hosted' })
        expect(pixRouteReportEntry(step('accept-tos:avenia'), [terms])).toMatchObject({ state: 'ready' })
        expect(pixRouteGate(step('verify'), [hosted])).toEqual({ kind: 'needs-enrollment' })
        // the Peanut identity check stays the identity step
        expect(pixRouteReportEntry(step('verify'))).toMatchObject({ state: 'action_required', action: 'verify' })
        expect(pixRouteGate(step('verify'))).toEqual({ kind: 'needs-identity' })
    })

    it('reads a refused identity as a verification not accepted', () => {
        expect(pixRefusalCopy({ code: 'IDENTITY_REJECTED', userMessage: 'Rejected.' })).toBe('rejected')
    })
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
            withPixRoute(servedElsewhere, [route({ state: 'action_required', action: 'accept-tos:avenia' })]).local
                .accounts.BRL
        ).toMatchObject({ state: 'ready', action: 'accept-tos:avenia' })
    })

    it('gates the Pix corridor by the route', () => {
        expect(pixRouteGate(route())).toEqual({ kind: 'ready' })
        expect(pixRouteGate(route({ state: 'action_required', action: 'verify' }))).toEqual({ kind: 'needs-identity' })
        expect(pixRouteGate(route({ state: 'action_required', action: 'accept-tos:avenia' }))).toEqual({
            kind: 'needs-enrollment',
        })
        expect(pixRouteGate(route({ state: 'pending' })).kind).toBe('waiting-on-provider')
        expect(pixRouteGate(route({ state: 'refused' })).kind).toBe('blocked-rejection')
    })
})
