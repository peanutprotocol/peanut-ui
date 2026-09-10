/**
 * @jest-environment jsdom
 */
import { act, renderHook, waitFor } from '@testing-library/react'
import { rainApi } from '@/services/rain'
import { useCardRecoveryFlow } from '../useCardRecoveryFlow'

const mockSignTypedData = jest.fn(async () => '0xsig')

jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}))
jest.mock('@/context/kernelClient.context', () => ({
    useKernelClient: () => ({
        getClientForChain: () => ({ account: { signTypedData: mockSignTypedData } }),
    }),
}))
jest.mock('@/utils/rainWithdraw.utils', () => ({
    buildRainWithdrawTypedData: jest.fn(() => ({})),
}))
jest.mock('@/constants/zerodev.consts', () => ({
    PEANUT_WALLET_CHAIN: { id: 42161 },
}))
jest.mock('@/services/rain', () => ({
    rainApi: {
        getRecoverFundsPreview: jest.fn(),
        prepareRecoverFunds: jest.fn(),
        submitWithdrawal: jest.fn(),
    },
}))

const mockGetPreview = rainApi.getRecoverFundsPreview as jest.Mock
const mockPrepare = rainApi.prepareRecoverFunds as jest.Mock
const mockSubmit = rainApi.submitWithdrawal as jest.Mock

const validPreview = {
    amountCents: '12345',
    dustWei: '0',
    recipient: '0xabc',
    hasRecoverableCard: true,
    autoBalanceEnabled: false,
}

const prep = {
    preparationId: 'prep-1',
    amountCents: '9900',
    amount: '9900',
    recipientAddress: '0xabc',
    directTransfer: true,
    adminSalt: 's',
    adminNonce: 'n',
    executorSignature: 'x',
    executorSalt: 'xs',
    expiresAt: 'later',
    chainId: '42161',
}

describe('useCardRecoveryFlow', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('loads a valid preview on mount', async () => {
        mockGetPreview.mockResolvedValue(validPreview)
        const { result } = renderHook(() => useCardRecoveryFlow())
        await waitFor(() => expect(result.current.preview).toEqual(validPreview))
        expect(result.current.error).toBeNull()
        expect(result.current.step).toBe('preview')
    })

    it('rejects a malformed preview with an error instead of a white screen', async () => {
        mockGetPreview.mockResolvedValue({ ...validPreview, amountCents: undefined })
        const { result } = renderHook(() => useCardRecoveryFlow())
        await waitFor(() => expect(result.current.error).toBe('previewFailed'))
        expect(result.current.preview).toBeNull()
    })

    it('signs and submits, reporting the prepared amount, not the stale preview', async () => {
        mockGetPreview.mockResolvedValue(validPreview)
        mockPrepare.mockResolvedValue(prep)
        mockSubmit.mockResolvedValue({ txHash: '0xhash' })
        const { result } = renderHook(() => useCardRecoveryFlow())
        await waitFor(() => expect(result.current.preview).toEqual(validPreview))
        await act(async () => {
            await result.current.handleRecover()
        })
        expect(result.current.step).toBe('done')
        expect(result.current.txHash).toBe('0xhash')
        expect(result.current.recoveredCents).toBe('9900')
        expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({ adminSignature: '0xsig' }))
    })

    it('returns to preview with an error when recovery fails', async () => {
        mockGetPreview.mockResolvedValue(validPreview)
        mockPrepare.mockRejectedValue(new Error('nope'))
        const { result } = renderHook(() => useCardRecoveryFlow())
        await waitFor(() => expect(result.current.preview).toEqual(validPreview))
        await act(async () => {
            await result.current.handleRecover()
        })
        expect(result.current.step).toBe('preview')
        expect(result.current.error).toBe('nope')
    })
})
