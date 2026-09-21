/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { useFixCardSignatureFlow } from '../useFixCardSignatureFlow'

const mockDiagnose = jest.fn()
const mockRepair = jest.fn()
const mockGrant = jest.fn()
const mockApproveFunding = jest.fn()

let mockAddress: string | null = null
let mockDiagnosis: { state: string; currentNonce?: string; validNonceFrom?: string } | null = null

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))
jest.mock('@/hooks/useRainCardOverview', () => ({
    useRainCardOverview: () => ({
        overview: { cards: [{ id: 'c1', status: 'ACTIVE' }] },
        isLoading: false,
    }),
}))
jest.mock('@/hooks/useZeroDev', () => ({
    useZeroDev: () => ({ address: mockAddress }),
}))
jest.mock('@/hooks/wallet/useCardSignatureRepair', () => ({
    useCardSignatureRepair: () => ({
        diagnosis: mockDiagnosis,
        isDiagnosing: false,
        isRepairing: false,
        error: null,
        diagnose: mockDiagnose,
        repair: mockRepair,
    }),
}))
jest.mock('@/hooks/wallet/useGrantSessionKey', () => ({
    useGrantSessionKey: () => ({ grant: mockGrant, isGranting: false }),
}))
jest.mock('@/hooks/wallet/useRainFunding', () => ({
    useRainFunding: () => ({ approve: mockApproveFunding, isSubmitting: false }),
}))

describe('useFixCardSignatureFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockAddress = null
        mockDiagnosis = null
    })

    it('does not diagnose before the zerodev address hydrates', () => {
        renderHook(() => useFixCardSignatureFlow())
        expect(mockDiagnose).not.toHaveBeenCalled()
    })

    it('diagnoses once the address exists', () => {
        mockAddress = '0xabc'
        renderHook(() => useFixCardSignatureFlow())
        expect(mockDiagnose).toHaveBeenCalledTimes(1)
    })

    it('computes needsRepair from the diagnosis', () => {
        mockDiagnosis = { state: 'nonce-bricked' }
        expect(renderHook(() => useFixCardSignatureFlow()).result.current.needsRepair).toBe(true)

        mockDiagnosis = { state: 'healthy' }
        expect(renderHook(() => useFixCardSignatureFlow()).result.current.needsRepair).toBe(false)
    })

    // The session-key grant only repairs WITHDRAWALS. The card is funded by
    // Rain's operator approval, so "done" needs both — in that order.
    it('is done only after the withdrawal grant AND the Rain funding approval', async () => {
        const order: string[] = []
        mockGrant.mockImplementation(async () => {
            order.push('grant')
            return { ok: true }
        })
        mockApproveFunding.mockImplementation(async () => {
            order.push('approve')
            return { ok: true }
        })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(order).toEqual(['grant', 'approve'])
        expect(result.current.grantDone).toBe(true)
        expect(result.current.grantErrorMessage).toBeNull()
    })

    it('a repaired withdrawal permission alone is not "all set"', async () => {
        mockGrant.mockResolvedValue({ ok: true })
        mockApproveFunding.mockResolvedValue({ ok: false, error: { kind: 'not-confirmed' } })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(result.current.withdrawalsRepaired).toBe(true)
        expect(result.current.grantDone).toBe(false)
        expect(result.current.grantErrorMessage).toBe('fixSignature.fundingFailed')
    })

    it('a retry after a failed funding approval does not re-sign the withdrawal grant', async () => {
        mockGrant.mockResolvedValue({ ok: true })
        mockApproveFunding.mockResolvedValueOnce({ ok: false, error: { kind: 'user-cancelled' } })
        mockApproveFunding.mockResolvedValueOnce({ ok: true })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(result.current.grantDone).toBe(false)
        expect(result.current.grantErrorMessage).toBeNull()
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(mockGrant).toHaveBeenCalledTimes(1)
        expect(mockApproveFunding).toHaveBeenCalledTimes(2)
        expect(result.current.grantDone).toBe(true)
    })

    it('never asks for the funding approval when the withdrawal grant fails', async () => {
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'unexpected', message: 'AA23' } })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(mockApproveFunding).not.toHaveBeenCalled()
        expect(result.current.grantErrorMessage).toBe('fixSignature.regrantFailed')
    })

    it('surfaces the no-card message on a no-card grant failure', async () => {
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'no-card' } })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(result.current.grantDone).toBe(false)
        expect(result.current.grantErrorMessage).toBe('fixSignature.noActiveCard')
    })

    it('stays silent when the user cancels the passkey tap', async () => {
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'user-cancelled' } })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(result.current.grantErrorMessage).toBeNull()
    })
})
