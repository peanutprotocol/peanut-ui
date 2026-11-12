import { renderHook } from '@testing-library/react'
import { useBankChipFor, useBankEntryFor, useBankRows } from '@/hooks/useBankRows'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import type { CapabilityRoute, NextAction, UserCapabilities } from '@/types/capabilities'
import { LOCAL_SERVED_ELSEWHERE_REASON } from '@/features/kyc-features/report'

let mockCapabilities: UserCapabilities
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ capabilities: mockCapabilities, nextActions: mockCapabilities.nextActions }),
}))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { userId: 'fixture-user' }, residence: { declared: { country: 'PT' } } } }),
}))
jest.mock('@/utils/native-platform', () => ({ useHydrationSnapshot: () => null }))

beforeEach(() => {
    mockCapabilities = withFeatureReport({ rails: [], nextActions: [], restrictions: [] })
})

describe('bank rows render the report account entries', () => {
    it('reads Processing only for the accounts the report is setting up', () => {
        mockCapabilities.features!.bank.accounts = {
            EUR: { state: 'setting_up' },
            USD: { state: 'setting_up' },
            MXN: { state: 'ready' },
        }
        const { result } = renderHook(() => useBankRows())
        expect(
            result.current.rows
                .filter((row) => ['sepa', 'usd', 'mxn'].includes(row.labelKey))
                .map((row) => [row.labelKey, row.chip])
        ).toEqual([
            ['sepa', 'processing'],
            ['usd', 'processing'],
            ['mxn', 'unlock'],
        ])
    })

    it('a refused account reads Not available, never Processing, even while the bank feature is setting up', () => {
        mockCapabilities.features!.bank = {
            state: 'setting_up',
            accounts: { USD: { state: 'refused', reason: 'account_unavailable_in_residence' }, EUR: { state: 'on' } },
        }
        const { result } = renderHook(() => useBankRows())
        const usd = result.current.rows.find((row) => row.labelKey === 'usd')!
        expect(usd).toMatchObject({ chip: 'notAvailable', unavailableBecause: 'account-residence' })
        expect(usd.chip).not.toBe('processing')
        expect(usd.regionPath).toBeUndefined()
        expect(result.current.rows.find((row) => row.labelKey === 'sepa')?.chip).toBe('active')
    })

    it('reads local accounts independently of bank accounts and exposes their exact entries', () => {
        mockCapabilities.features!.local.accounts = { BRL: { state: 'ready' }, ARS: { state: 'setting_up' } }
        const { result } = renderHook(() => ({
            rows: useBankRows().rows,
            chipFor: useBankChipFor(),
            entryFor: useBankEntryFor(),
        }))
        expect(result.current.chipFor('brl')).toBe('unlock')
        expect(result.current.chipFor('ars')).toBe('processing')
        expect(result.current.entryFor('ars')).toBe(mockCapabilities.features!.local.accounts.ARS)
        expect(result.current.rows.find((row) => row.labelKey === 'ars')?.chip).toBe('processing')
    })

    it('keeps on, attention, ready and unknown entries distinct and returns the aggregate report chip', () => {
        mockCapabilities.nextActions = [{ key: 'restart', kind: 'restart-identity', purpose: 'country_not_supported' }]
        mockCapabilities.features!.bank = {
            state: 'on',
            accounts: { EUR: { state: 'action_required', action: 'restart' }, USD: { state: 'ready' } },
        }
        const { result, rerender } = renderHook(() => useBankRows())
        expect(result.current.accountChip).toBe('active')
        expect(result.current.rows.find((row) => row.labelKey === 'sepa')?.chip).toBe('attention')
        expect(result.current.rows.find((row) => row.labelKey === 'usd')?.chip).toBe('unlock')
        mockCapabilities = { rails: [], nextActions: [], restrictions: [] }
        rerender()
        expect(result.current.accountChip).toBe('processing')
        expect(result.current.rows.every((row) => row.chip === 'processing')).toBe(true)
    })
})

// The API refuses the local feature to a resident of Brazil (`local_residence_unsupported`) and serves
// their Pix through the route (Avenia): the BRL row reads the route, never the refused local account.
describe('the BRL row reads the Pix route', () => {
    const pixRoute = (step: Partial<CapabilityRoute>): CapabilityRoute => ({
        operation: 'deposit',
        method: 'PIX_BR',
        provider: 'avenia',
        state: 'ready',
        candidates: [],
        ...step,
    })
    const brazilResident = (reason = 'local_residence_unsupported') => {
        mockCapabilities.features!.local = {
            state: 'refused',
            reason,
            accounts: { BRL: { state: 'refused', reason } },
        }
    }
    const brl = () => renderHook(() => useBankRows()).result.current.rows.find((row) => row.labelKey === 'brl')!

    // a refused Pix route closes the row for its own reason, which its drawer says; never the residence rule
    it.each(['provider_unavailable', 'rollout_closed', 'residence_paused', 'provider_paused', 'residence_not_served'])(
        'closes the row for the route reason (%s), not as a residence refusal',
        (code) => {
            brazilResident()
            mockCapabilities.routes = [
                pixRoute({ provider: null, state: 'refused', reason: { code, userMessage: '' } }),
            ]
            expect(brl()).toMatchObject({ chip: 'notAvailable', unavailableBecause: 'pix-route' })
        }
    )

    it('reads a ready route as an active row, where the refused local account alone reads closed', () => {
        brazilResident()
        expect(brl()).toMatchObject({ chip: 'notAvailable', unavailableBecause: 'residence' })

        mockCapabilities.routes = [pixRoute({ state: 'ready' })]
        expect(brl().chip).toBe('active')
        expect(brl().unavailableBecause).toBeUndefined()
        expect(renderHook(() => useBankRows()).result.current.accountChip).toBe('active')
    })

    // the API's answer for a resident of Brazil: another entry, the Pix route, serves the residence
    it('reads a local refusal because another entry serves the residence like the residence one', () => {
        brazilResident(LOCAL_SERVED_ELSEWHERE_REASON)
        expect(brl()).toMatchObject({ chip: 'notAvailable', unavailableBecause: 'residence' })

        mockCapabilities.routes = [pixRoute({ state: 'ready' })]
        expect(brl().chip).toBe('active')
        expect(brl().unavailableBecause).toBeUndefined()
        expect(renderHook(() => useBankRows()).result.current.accountChip).toBe('active')
    })

    it.each<[string, Partial<CapabilityRoute>, string]>([
        ['the provider terms', { state: 'action_required', action: 'accept-tos:avenia' }, 'unlock'],
        ['the identity check', { state: 'action_required', action: 'verify' }, 'unlock'],
        [
            'the provider review',
            { state: 'pending', reason: { code: 'provider_reviewing', userMessage: '' } },
            'processing',
        ],
        ['a pause', { state: 'paused', reason: { code: 'residence_paused', userMessage: '' } }, 'processing'],
        ['a refusal', { state: 'refused', reason: { code: 'provider_rejected', userMessage: '' } }, 'notAvailable'],
    ])('reads %s on the route as the row would read it', (_name, step, chip) => {
        brazilResident()
        mockCapabilities.routes = [pixRoute(step)]
        expect(brl().chip).toBe(chip)
    })

    // the provider takes no shared verification: its own check, on its page, is a set-up step like its terms
    it("reads the provider's own identity check as Set up, like the terms", () => {
        brazilResident()
        mockCapabilities.nextActions = [
            {
                key: 'avenia-hosted',
                kind: 'hosted-identity',
                purpose: 'unlock-avenia',
                url: 'https://avenia.example/identity/u1',
                expiresAt: '2099-01-01T00:00:00.000Z',
            },
        ]
        mockCapabilities.routes = [pixRoute({ state: 'action_required', action: 'avenia-hosted' })]
        expect(brl().chip).toBe('unlock')
        expect(renderHook(() => useBankEntryFor()).result.current('brl')).toEqual({
            state: 'ready',
            action: 'avenia-hosted',
        })
    })

    // TASK-24841: before our own check, the provider's own set-up is the Pix setup's to run
    it.each([
        ['its terms', 'accept-tos:avenia', 'accept-tos'],
        ['its own identity check', 'avenia-hosted', 'hosted-identity'],
    ])("reads the provider's %s as Set up and opens the Pix setup, never our verification", (_name, action, kind) => {
        brazilResident()
        mockCapabilities.nextActions = [{ key: action, kind, purpose: 'unlock-avenia' } as NextAction]
        mockCapabilities.routes = [pixRoute({ state: 'action_required', action })]
        expect(brl()).toMatchObject({ chip: 'unlock', href: '/add-money/pix' })
    })

    it('leaves the row on our verification where the route asks for it first', () => {
        brazilResident()
        mockCapabilities.routes = [pixRoute({ state: 'action_required', action: 'verify' })]
        expect(brl().chip).toBe('unlock')
        expect(brl().href).toBeUndefined()
    })

    it('keeps the report for the other rows, and for BRL when the API sends no Pix route', () => {
        mockCapabilities.features!.local.accounts = { BRL: { state: 'on' }, ARS: { state: 'refused' } }
        mockCapabilities.routes = [pixRoute({ state: 'ready', operation: 'pay' })]
        const { result } = renderHook(() => useBankRows())
        expect(result.current.rows.find((row) => row.labelKey === 'brl')?.chip).toBe('active')
        expect(result.current.rows.find((row) => row.labelKey === 'ars')?.chip).toBe('notAvailable')
    })
})
