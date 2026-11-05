import { renderHook } from '@testing-library/react'
import { useBankChipFor, useBankEntryFor, useBankRows } from '@/hooks/useBankRows'
import { withFeatureReport } from '@/test-utils/featureReport.fixture'
import type { UserCapabilities } from '@/types/capabilities'

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
