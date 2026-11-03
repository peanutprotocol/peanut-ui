/**
 * @jest-environment jsdom
 */
import { act, renderHook } from '@testing-library/react'
import { useFixCardSignatureFlow } from '../useFixCardSignatureFlow'

const mockDiagnose = jest.fn()
const mockRepair = jest.fn()
const mockGrant = jest.fn()
const mockFundingGrant = jest.fn()

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
    useRainFunding: () => ({ grant: mockFundingGrant }),
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

    // This page repairs WITHDRAWALS only. The card funding permission needs the
    // person's own consent boxes, which live on the Home prompt.
    it('is done after the withdrawal grant alone and never signs the funding permission', async () => {
        mockGrant.mockResolvedValue({ ok: true })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(mockGrant).toHaveBeenCalledTimes(1)
        expect(mockFundingGrant).not.toHaveBeenCalled()
        expect(result.current.grantDone).toBe(true)
        expect(result.current.grantErrorMessage).toBeNull()
    })

    it('reports a failed withdrawal grant with the retry message', async () => {
        mockGrant.mockResolvedValue({ ok: false, error: { kind: 'unexpected', message: 'AA23' } })
        const { result } = renderHook(() => useFixCardSignatureFlow())
        await act(async () => {
            await result.current.handleGrant()
        })
        expect(result.current.grantDone).toBe(false)
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
