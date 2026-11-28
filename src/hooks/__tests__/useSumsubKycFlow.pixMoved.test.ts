jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

import { act } from '@testing-library/react'
import { renderHookWithIntl as renderHook } from '@/test-utils/intl'
import { useSumsubKycFlow } from '@/hooks/useSumsubKycFlow'
import { initiateSumsubKyc, startKycAction } from '@/app/actions/sumsub'

jest.mock('@/app/actions/kyc-workflow', () => {
    const getKycDocumentPlan = jest.fn(async () => ({ available: false, flow: null, routes: [] }))
    return {
        getKycDocumentStatus: jest.fn(async () => 'IN_REVIEW'),
        getKycDocumentPlan,
        findKycDocumentPlan: jest.fn(() => getKycDocumentPlan().catch(() => null)),
        resumeKycDocumentAttempt: jest.fn(),
        findKycReplacementPlan: jest.fn(async () => null),
    }
})

// the same boundaries as useSumsubKycFlow.test.ts: the server actions, the websocket, auth and the router

const mockWs: { handler?: (status: string, labels?: string[]) => void } = {}
jest.mock('@/app/actions/sumsub', () => ({
    ...jest.requireActual('@/app/actions/sumsub'),
    // Only the network-touching actions are stubbed. Pure helpers like
    // isTerminalActionCode come from the real module: they encode which
    // refusals are permanent, and a stub would let the hook's terminal
    // branch pass a test while doing nothing in production.
    initiateSumsubKyc: jest.fn(),
    initiateSelfHealResubmission: jest.fn(),
    restartIdentityVerification: jest.fn(),
    startResidenceChangeVerification: jest.fn(),
    startKycAction: jest.fn(),
    refreshVerificationSession: jest.fn(),
    getVerificationSession: jest.fn(async () => null),
}))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))

jest.mock('@/hooks/useWebSocket', () => ({
    useWebSocket: (opts: { onSumsubKycStatusUpdate?: (status: string, labels?: string[]) => void }) => {
        mockWs.handler = opts.onSumsubKycStatusUpdate
    },
}))
let mockRoutes: Array<Record<string, unknown>> = []
const mockFetchUser = jest.fn(async () => ({ user: { username: 'test' }, capabilities: { routes: mockRoutes } }))
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({ user: { user: { username: 'test' } }, fetchUser: mockFetchUser }),
}))
const mockRouterPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockRouterPush, replace: jest.fn() }) }))
jest.mock('@/utils/capacitor', () => ({ isCapacitor: () => false }))

const mockInitiate = initiateSumsubKyc as jest.MockedFunction<typeof initiateSumsubKyc>
const mockStartAction = startKycAction as jest.MockedFunction<typeof startKycAction>

/**
 * A Manteca session for Brazil answers 409 PIX_PROVIDER_MOVED for a user whose Pix the routes name
 * Avenia for, or once Manteca's BRL is switched off (API-CONTRACT-M5 §7). Manteca has nothing to verify
 * for them: the user goes to the Pix flow, which opens the routes' account with no tap.
 */
const MOVED = { code: 'PIX_PROVIDER_MOVED' as const, error: 'Pix now runs through another partner.' }
const route = (operation: string, state = 'action_required') => ({
    operation,
    method: 'PIX_BR',
    provider: 'avenia',
    state,
})

describe('useSumsubKycFlow — a Manteca Brazil session refused because Pix moved', () => {
    beforeEach(() => {
        mockInitiate.mockReset()
        mockStartAction.mockReset()
        mockRouterPush.mockReset()
        mockFetchUser.mockClear()
        mockWs.handler = undefined
    })

    it('the identity start sends a resident to the Pix add-money page, with no error', async () => {
        mockRoutes = [route('deposit'), route('withdraw'), route('pay')]
        mockInitiate.mockResolvedValue(MOVED)
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'BR')
        })

        expect(mockFetchUser).toHaveBeenCalled()
        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/pix')
        expect(result.current.error).toBeNull()
        expect(result.current.showWrapper).toBe(false)
    })

    it('a user whose deposit route is refused (a resident abroad) goes to the Pix withdraw page', async () => {
        mockRoutes = [{ operation: 'deposit', method: 'PIX_BR', state: 'refused' }, route('withdraw')]
        mockInitiate.mockResolvedValue(MOVED)
        const { result } = renderHook(() => useSumsubKycFlow({}))

        await act(async () => {
            await result.current.handleInitiateKyc('LATAM', undefined, true, 'BR')
        })

        expect(mockRouterPush).toHaveBeenCalledWith('/withdraw/pix')
    })

    it('a start-action refused the same way goes to the Pix flow too', async () => {
        mockRoutes = [route('deposit')]
        mockStartAction.mockResolvedValue(MOVED)
        const { result } = renderHook(() => useSumsubKycFlow())

        await act(async () => {
            await result.current.handleFixableRejection({ provider: 'MANTECA', actionKey: 'sumsub:manteca_br' })
        })

        expect(mockRouterPush).toHaveBeenCalledWith('/add-money/pix')
        expect(result.current.error).toBeNull()
        expect(result.current.showWrapper).toBe(false)
    })
})
