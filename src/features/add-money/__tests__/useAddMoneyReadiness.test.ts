import { renderHook } from '@testing-library/react'
import type { CapabilityRoute, FeatureReport } from '@/types/capabilities'
import { useAddMoneyReadiness } from '../useAddMoneyReadiness'

const mockGateFor = jest.fn()
const mockQuery = jest.fn()
let mockReport: FeatureReport | undefined
let mockRoutes: CapabilityRoute[] | undefined
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
    useCapabilities: () => ({
        gateFor: mockGateFor,
        capabilities: { features: mockReport, routes: mockRoutes },
        isLoading: false,
    }),
}))
let mockResidence: string[] = ['PT']
jest.mock('@/features/deposit-accounts/useResidenceIso2s', () => ({ useResidenceIso2s: () => mockResidence }))
jest.mock('@/features/deposit-accounts/useDepositAccountsEnabled', () => ({
    useDepositAccountsEnabled: () => mockStandingEnabled,
}))
jest.mock('@tanstack/react-query', () => ({ useQuery: (...args: unknown[]) => mockQuery(...args) }))

beforeEach(() => {
    mockResidence = ['PT']
    mockStandingEnabled = true
    mockUserId = 'current-owner'
    mockOneShot = false
    mockReport = undefined
    mockRoutes = undefined
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
    // bank accounts stay on offer (the owner, 15 Nov); the pending EUR is not a ready account; the
    // ready USD transfer is on the picker only
    expect(result.current.drawerMethods).toEqual(['account', 'crypto', 'more'])
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

// Pix leads Home's Add drawer only on a Pix deposit route on Avenia (Aleks, 2026-11-12 and 2026-11-14).
// The route goes through the real rule (`pixDepositOffered`).
const pixDeposit = (route: Partial<CapabilityRoute>) =>
    [{ operation: 'deposit', method: 'PIX_BR', provider: 'avenia', state: 'ready', ...route }] as CapabilityRoute[]
const residencePaused = { code: 'residence_paused', userMessage: 'Deposits and withdrawals are paused where you live.' }

it('reads the Brazil pause from the Pix deposit route and keeps Pix off the drawer while it is paused', () => {
    mockRoutes = pixDeposit({ provider: null, state: 'paused', reason: residencePaused })
    const { result, rerender } = renderHook(() => useAddMoneyReadiness(true))
    expect(result.current.brazilPaused).toBe(true)
    expect(result.current.ready.pix).toEqual([])

    mockRoutes = pixDeposit({ state: 'ready' })
    rerender()
    expect(result.current.brazilPaused).toBe(false)
    expect(result.current.drawerMethods[0]).toBe('pix')
})

it('leads with Pix while Avenia is setting up or reviewing: the first tap is the setup', () => {
    mockRoutes = pixDeposit({ state: 'action_required' })
    const { result } = renderHook(() => useAddMoneyReadiness(true))
    expect(result.current.pickerMethods[0]).toBe('pix')
    expect(result.current.drawerMethods).toEqual(['pix', 'account', 'crypto'])
    // a route offered before verification is not a ready top-up: a new user still lands on the picker
    expect(result.current.entry).toBe('picker')
})

it('keeps Pix on offer through an outage of Avenia: the Pix page shows the outage itself', () => {
    mockRoutes = pixDeposit({
        state: 'paused',
        reason: { code: 'provider_paused', userMessage: 'This is paused for a moment. Try again soon.' },
    })
    const { result } = renderHook(() => useAddMoneyReadiness(true))
    expect(result.current.brazilPaused).toBe(false)
    expect(result.current.drawerMethods[0]).toBe('pix')
})

// The pause names no provider outside a provider's rollout, and the provider inside it for a resident not on its allowed list
it.each<CapabilityRoute['provider']>([null, 'avenia'])(
    'offers no Pix row to a resident under the Brazil pause, route provider %s (Aleks, 2026-11-14)',
    (provider) => {
        mockRoutes = pixDeposit({ provider, state: 'paused', reason: residencePaused })
        const { result } = renderHook(() => useAddMoneyReadiness(true))
        expect(result.current.brazilPaused).toBe(true)
        expect(result.current.drawerMethods).not.toContain('pix')
    }
)

// Aleks, 2026-11-14: every user outside Brazil has a Manteca Pix route; they find BRL in the bank list
it.each<[string, Partial<CapabilityRoute>]>([
    ['a Manteca route', { provider: 'manteca', state: 'action_required' }],
    ['a refused route', { provider: null, state: 'refused' }],
])('offers no Pix row on %s', (_name, route) => {
    mockRoutes = pixDeposit(route)
    const { result } = renderHook(() => useAddMoneyReadiness(true))
    expect(result.current.ready.pix).toEqual([])
    expect(result.current.drawerMethods).not.toContain('pix')
})

// The owner, 15 Nov: the picker offers Pix by the same rule as the drawer, from the route and the residence
it.each<[string, string[], Partial<CapabilityRoute>, boolean]>([
    [
        'a resident of Brazil whose Manteca route waits for its first use',
        ['BR'],
        { provider: 'manteca', state: 'action_required' },
        true,
    ],
    ['a user outside Brazil on the same route', ['PT'], { provider: 'manteca', state: 'action_required' }, false],
    ['a resident of Brazil whose route is refused', ['BR'], { provider: null, state: 'refused' }, false],
    [
        'a resident of Brazil under the Brazil pause',
        ['BR'],
        { provider: null, state: 'paused', reason: residencePaused },
        false,
    ],
])('the picker offers Pix to %s: %s', (_name, residence, route, offered) => {
    mockResidence = residence
    mockRoutes = pixDeposit(route)
    const { result } = renderHook(() => useAddMoneyReadiness(false))
    expect(result.current.pickerMethods.includes('pix')).toBe(offered)
})

// The owner, 24 Nov (TASK-25350): the API sends no peso route, so the ARS row reads the peso top-up's gate
const arsGate = (gate: { kind: string }) =>
    mockGateFor.mockImplementation((_: string, scope: { railId: string }) =>
        scope.railId === 'manteca.bank_transfer_ar' ? gate : { kind: 'not-offered' }
    )

it('leads with ARS on a ready peso top-up, and the user is returning', () => {
    mockResidence = ['AR']
    arsGate({ kind: 'ready' })
    const { result } = renderHook(() => useAddMoneyReadiness(true))
    expect(result.current.ready.ars).toEqual(['ARS'])
    expect(result.current.ready.transfer).toEqual([])
    expect(result.current.drawerMethods[0]).toBe('ars')
    expect(result.current.entry).toBe('drawer')
})

it.each(['needs-identity', 'needs-enrollment', 'accept-tos', 'pending', 'waiting-on-provider', 'fixable-rejection'])(
    'offers the ARS row to a resident whose peso gate is %s: the flow takes them through the step',
    (kind) => {
        mockResidence = ['AR']
        arsGate({ kind })
        const { result } = renderHook(() => useAddMoneyReadiness(false))
        expect(result.current.pickerMethods[0]).toBe('ars')
        expect(result.current.ready.ars).toEqual([])
        expect(result.current.entry).toBe('picker')
    }
)

it.each(['loading', 'blocked-rejection', 'restart-identity'])('offers no ARS row while the peso gate is %s', (kind) => {
    mockResidence = ['AR']
    arsGate({ kind })
    const { result } = renderHook(() => useAddMoneyReadiness(false))
    expect(result.current.pickerMethods).not.toContain('ars')
})

it('offers no ARS row to a resident of another country, whatever the gate says', () => {
    mockResidence = ['BR']
    arsGate({ kind: 'ready' })
    const { result } = renderHook(() => useAddMoneyReadiness(false))
    expect(result.current.pickerMethods).not.toContain('ars')
    expect(result.current.ready.ars).toEqual([])
})
