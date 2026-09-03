/**
 * cancelSendLink on a link the recipient already claimed: the API answers 409
 * LINK_ALREADY_CLAIMED and leaves the link CLAIMED. The hook must refetch the
 * list (so the entry re-renders as claimed) and say so — not report a failure
 * that leaves a live "try again" on a link that is gone (TASK-22091).
 */
import { renderHook } from '@testing-library/react'
import { TRANSACTIONS } from '@/constants/query.consts'

const mockCancelLinkAndClaim = jest.fn()
const mockInvalidateQueries = jest.fn(async () => undefined)
const mockToast = { success: jest.fn(), error: jest.fn(), info: jest.fn(), warning: jest.fn() }

jest.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({ invalidateQueries: mockInvalidateQueries }),
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/components/Claim/useClaimLink', () => ({
    __esModule: true,
    default: () => ({
        cancelLinkAndClaim: mockCancelLinkAndClaim,
        pollForClaimConfirmation: jest.fn(async () => true),
    }),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => mockToast }))
jest.mock('@/hooks/wallet/useWallet', () => ({ useWallet: () => ({ fetchBalance: jest.fn() }) }))
jest.mock('@/redux/hooks', () => ({
    useUserStore: () => ({
        user: { user: { userId: 'u1' }, accounts: [{ type: 'peanut-wallet', identifier: '0xwallet' }] },
    }),
}))
jest.mock('@/services/charges', () => ({ chargesApi: {} }))
jest.mock('@/services/requests', () => ({ requestsApi: {} }))

import { useReceiptActions } from '../useReceiptActions'
import type { TransactionDetails } from '../transactionTransformer'

const tx = { id: 'tx-1', extraDataForDrawer: { link: 'https://peanut.me/claim#p=pw' } } as unknown as TransactionDetails

beforeEach(() => jest.clearAllMocks())

describe('useReceiptActions.cancelSendLink', () => {
    test('an already-claimed link refetches the list and reports already-claimed', async () => {
        mockCancelLinkAndClaim.mockRejectedValue(
            Object.assign(new Error('This link was already claimed.'), { code: 'LINK_ALREADY_CLAIMED' })
        )
        const { result } = renderHook(() => useReceiptActions(tx))

        await expect(result.current.cancelSendLink()).resolves.toBe('already-claimed')

        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: [TRANSACTIONS] })
        // localized through friendlyError, not the generic cancel-failed copy
        expect(mockToast.info).toHaveBeenCalledWith('sendLinkAlreadyClaimed')
        expect(mockToast.error).not.toHaveBeenCalled()
    })

    test('a refetch failure after already-claimed is not a cancel failure', async () => {
        mockCancelLinkAndClaim.mockRejectedValue(
            Object.assign(new Error('This link was already claimed.'), { code: 'LINK_ALREADY_CLAIMED' })
        )
        mockInvalidateQueries.mockRejectedValueOnce(new Error('offline'))
        const { result } = renderHook(() => useReceiptActions(tx))

        await expect(result.current.cancelSendLink()).resolves.toBe('already-claimed')
        expect(mockToast.info).toHaveBeenCalledWith('sendLinkAlreadyClaimed')
    })

    test('any other failure reports failed with the retry toast', async () => {
        mockCancelLinkAndClaim.mockRejectedValue(new Error('paymaster down'))
        const { result } = renderHook(() => useReceiptActions(tx))

        await expect(result.current.cancelSendLink()).resolves.toBe('failed')

        expect(mockToast.error).toHaveBeenCalledWith('toast.cancelLinkFailed')
        expect(mockInvalidateQueries).not.toHaveBeenCalled()
    })

    test('a successful cancel reports cancelled', async () => {
        mockCancelLinkAndClaim.mockResolvedValue('0xtx')
        const { result } = renderHook(() => useReceiptActions(tx))

        await expect(result.current.cancelSendLink()).resolves.toBe('cancelled')
        expect(mockToast.success).toHaveBeenCalledWith('toast.linkCancelled')
    })
})
