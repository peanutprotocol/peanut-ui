import { renderHook } from '@testing-library/react'
import type { FeatureReport } from '@/types/capabilities'
import { useAddMoneyReadiness } from '../useAddMoneyReadiness'

const mockGateFor = jest.fn()
const mockQuery = jest.fn()
let mockReport: FeatureReport | undefined
let mockUserId: string | undefined
let mockOneShot: boolean
let mockStandingEnabled: boolean

jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: mockUserId ? { user: { userId: mockUserId }, identityVerification: { oneShot: mockOneShot } } : undefined,
        userId: mockUserId,
    }),
}))
jest.mock('@/hooks/useCapabilities', () => ({
    useCapabilities: () => ({ gateFor: mockGateFor, capabilities: { features: mockReport }, isLoading: false }),
}))
jest.mock('@/features/brazil-pause/useBrazilServicesPaused', () => ({ useBrazilServicesPaused: () => false }))
jest.mock('@/features/deposit-accounts/useResidenceIso2s', () => ({ useResidenceIso2s: () => ['PT'] }))
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockStandingEnabled,
}))
jest.mock('@tanstack/react-query', () => ({ useQuery: (...args: unknown[]) => mockQuery(...args) }))

beforeEach(() => {
    mockStandingEnabled = true
    mockUserId = 'current-owner'
    mockOneShot = false
    mockReport = undefined
    mockGateFor.mockReset().mockReturnValue({ kind: 'not-offered' })
    mockQuery.mockReset().mockReturnValue({ data: { accounts: [], unavailable: [] }, isLoading: false, isError: false })
})

it('uses an owner-scoped account query and opens the picker when no profile is available', () => {
    mockUserId = undefined
    const { result } = renderHook(() => useAddMoneyReadiness(true))
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }))
    expect(result.current.entry).toBe('picker')
})

it('keeps a pending EUR report out of the drawer even if the rail says ready', () => {
    mockGateFor.mockImplementation((_: string, scope: { railId: string }) =>
        ['bridge.sepa_eu', 'bridge.ach_us'].includes(scope.railId) ? { kind: 'ready' } : { kind: 'not-offered' }
    )
    mockReport = {
        bank: { state: 'on', accounts: { EUR: { state: 'setting_up' } } },
        local: { state: 'ready', accounts: {} },
        card: { state: 'ready' },
        qr: { state: 'ready' },
    }
    mockQuery.mockReturnValue({
        data: {
            accounts: [{ railId: 'bridge.sepa_eu', status: 'active', instructions: { iban: 'PT123' } }],
            unavailable: [],
        },
        isLoading: false,
        isError: false,
    })
    const { result } = renderHook(() => useAddMoneyReadiness(true))

    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['deposit-accounts', 'current-owner'] }))
    expect(result.current.ready.account).toEqual([])
    expect(result.current.ready.transfer).toEqual(['USD'])
    expect(result.current.drawerMethods).toEqual(['transfer', 'crypto', 'more'])
})

it('requires transfer coordinates before calling a held COP account usable', () => {
    mockGateFor.mockImplementation((_: string, scope: { railId: string }) =>
        scope.railId === 'bridge.bank_transfer_co' ? { kind: 'ready' } : { kind: 'not-offered' }
    )
    mockQuery.mockReturnValue({
        data: {
            accounts: [{ railId: 'bridge.bank_transfer_co', status: 'active', instructions: { bankName: 'Bank' } }],
            unavailable: [],
        },
        isLoading: false,
        isError: false,
    })
    const { result, rerender } = renderHook(() => useAddMoneyReadiness(true))

    expect(result.current.entry).toBe('picker')
    mockQuery.mockReturnValue({
        data: {
            accounts: [
                {
                    railId: 'bridge.bank_transfer_co',
                    status: 'active',
                    instructions: { breBKey: 'key', depositMessage: 'reference' },
                },
            ],
            unavailable: [],
        },
        isLoading: false,
        isError: false,
    })
    rerender()
    expect(result.current.entry).toBe('drawer')
    expect(result.current.ready.account).toEqual(['COP'])
})

it('does not offer a pending provider preview even if the rail and exact report still say on', () => {
    mockGateFor.mockImplementation((_: string, scope: { railId: string }) =>
        scope.railId === 'bridge.ach_us' ? { kind: 'ready' } : { kind: 'not-offered' }
    )
    mockReport = {
        bank: { state: 'on', accounts: { USD: { state: 'on' } } },
        local: { state: 'ready', accounts: {} },
        card: { state: 'ready' },
        qr: { state: 'ready' },
    }
    mockQuery.mockReturnValue({
        data: { accounts: [], unavailable: [{ railId: 'bridge.ach_us', cause: 'review-pending' }] },
        isLoading: false,
        isError: false,
    })
    const { result } = renderHook(() => useAddMoneyReadiness(true))
    expect(result.current.entry).toBe('picker')
    expect(result.current.ready.transfer).toEqual([])
    expect(result.current.topUpGates.ACH_US).toEqual({ kind: 'pending' })
})

it('keeps a one-shot currency out of the drawer until its exact feature is on', () => {
    mockOneShot = true
    mockGateFor.mockImplementation((_: string, scope: { railId: string }) =>
        scope.railId === 'bridge.ach_us' ? { kind: 'ready' } : { kind: 'not-offered' }
    )
    const { result, rerender } = renderHook(() => useAddMoneyReadiness(true))
    expect(result.current.ready.transfer).toEqual([])
    expect(result.current.topUpGates.ACH_US).toEqual({ kind: 'needs-enrollment' })
    mockReport = {
        bank: { state: 'on', accounts: { USD: { state: 'on' } } },
        local: { state: 'ready', accounts: {} },
        card: { state: 'ready' },
        qr: { state: 'ready' },
    }
    rerender()
    expect(result.current.entry).toBe('drawer')
    expect(result.current.ready.transfer).toEqual(['USD'])
})

it('does not read or use cached standing accounts when disabled', () => {
    mockStandingEnabled = false
    mockGateFor.mockReturnValue({ kind: 'ready' })
    mockQuery.mockReturnValue({
        data: {
            accounts: [{ railId: 'bridge.sepa_eu', status: 'active', instructions: { iban: 'PT123' } }],
            unavailable: [],
        },
        isLoading: true,
        isError: false,
    })
    const { result } = renderHook(() => useAddMoneyReadiness(true))
    expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({ enabled: false, staleTime: 300000 }))
    expect(result.current.ready.account).toEqual([])
    expect(result.current.isLoading).toBe(false)
})
