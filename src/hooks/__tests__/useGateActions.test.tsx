import { act, renderHook } from '@testing-library/react'
import type { NextAction } from '@/types/capabilities'
import type { GateState } from '@/utils/capability-gate'
import { useGateActions } from '../useGateActions'

const mockPush = jest.fn()
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ setIsSupportModalOpen: jest.fn(), openSupportWithMessage: jest.fn() }),
}))

const flow = { handleInitiateKyc: jest.fn(), handleRestartIdentity: jest.fn(), handleFixableGate: jest.fn() }
const hosted: NextAction = { key: 'bridge-hosted', kind: 'bridge-hosted', purpose: 'bridge-additional-verification' }
const hostedGate: GateState = {
    kind: 'fixable-rejection',
    userMessage: null,
    actionKey: hosted.key,
    nextAction: hosted,
}

describe('useGateActions', () => {
    beforeEach(() => jest.clearAllMocks())

    it("opens the hosted check's page, which goes back to Accounts when it is done", async () => {
        const { result } = renderHook(() => useGateActions(flow))
        await act(() => result.current.verify(hostedGate, { provider: 'BRIDGE' }))
        expect(mockPush).toHaveBeenCalledWith('/profile/accounts/additional')
    })

    // TASK-24910: the Pix setup sends its rail's hosted check there, and the user comes back to Pix
    it('tells the hosted check which page to go back to', async () => {
        const { result } = renderHook(() => useGateActions(flow))
        await act(() => result.current.verify(hostedGate, { provider: 'BRIDGE', returnTo: '/withdraw/pix' }))
        expect(mockPush).toHaveBeenCalledWith('/profile/accounts/additional?returnTo=%2Fwithdraw%2Fpix')
    })

    it("runs a Bridge document step as the provider's own fix", async () => {
        const document: NextAction = { key: 'sumsub:tax_identification_number', kind: 'sumsub', purpose: 'x' }
        const gate: GateState = {
            kind: 'fixable-rejection',
            userMessage: null,
            actionKey: document.key,
            nextAction: document,
        }
        const { result } = renderHook(() => useGateActions(flow))
        await act(() => result.current.verify(gate, { provider: 'BRIDGE', returnTo: '/withdraw/pix' }))
        expect(flow.handleFixableGate).toHaveBeenCalledWith('BRIDGE', gate)
        expect(mockPush).not.toHaveBeenCalled()
    })
})
