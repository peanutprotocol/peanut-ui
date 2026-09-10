// The Download-PDF affordance: the anchor's platform behaviour (web anchor vs
// Capacitor external-open) and the visibility gate in useReceiptViewModel.
import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { DownloadReceiptPdfLink } from '../DownloadReceiptPdfLink'
import { useReceiptViewModel } from '../useReceiptViewModel'
import { EHistoryUserRole } from '@/hooks/useTransactionHistory'
import type { TransactionDetails } from '../transactionTransformer'
import { isCapacitor, openExternalUrl } from '@/utils/capacitor'

jest.mock('@/assets', () => ({}))
jest.mock('@/assets/payment-apps', () => ({ MERCADO_PAGO: '', PIX: '' }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn().mockReturnValue(false),
    isIOSNative: jest.fn().mockReturnValue(false),
    isAndroidNative: jest.fn().mockReturnValue(false),
    isLegacyWebKit: jest.fn().mockReturnValue(false),
    openExternalUrl: jest.fn().mockResolvedValue(undefined),
}))

const mockIsCapacitor = isCapacitor as jest.Mock
const mockOpenExternalUrl = openExternalUrl as jest.Mock

describe('DownloadReceiptPdfLink', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(false)
    })

    test('web: a plain download anchor pointing at the pdf route, locale in the URL', () => {
        render(
            <IntlWrapper>
                <DownloadReceiptPdfLink entryId="entry-1" kind="OFFRAMP" />
            </IntlWrapper>
        )
        const link = screen.getByRole('link', { name: 'Download PDF' })
        // locale rides the URL: it is the CDN cache key, and the only locale
        // signal the native external browser ever gets
        expect(link).toHaveAttribute('href', '/receipt/entry-1/pdf?kind=OFFRAMP&locale=en')
        expect(link).toHaveAttribute('download')
        expect(link).toHaveAttribute('target', '_blank')
        fireEvent.click(link)
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    })

    test('capacitor: the click opens the absolute production URL externally', () => {
        mockIsCapacitor.mockReturnValue(true)
        render(
            <IntlWrapper>
                <DownloadReceiptPdfLink entryId="entry-1" kind="SEND_LINK" />
            </IntlWrapper>
        )
        fireEvent.click(screen.getByRole('link', { name: 'Download PDF' }))
        expect(mockOpenExternalUrl).toHaveBeenCalledTimes(1)
        const opened = mockOpenExternalUrl.mock.calls[0][0] as string
        expect(opened).toMatch(/^https?:\/\//)
        expect(opened).toContain('/receipt/entry-1/pdf?kind=SEND_LINK&locale=en')
    })
})

const baseTx = {
    id: 'tx-1',
    amount: 5,
    direction: 'bank_withdraw',
    status: 'completed',
    userName: 'kkonrad',
    initials: 'KK',
    date: '2026-08-20T14:05:00.000Z',
    totalAmountCollected: 0,
    extraDataForDrawer: {
        originalType: 'TRANSACTION_INTENT',
        originalUserRole: EHistoryUserRole.SENDER,
        kind: 'OFFRAMP',
    },
} as unknown as TransactionDetails

const tx = (overrides: Record<string, unknown> = {}, drawerOverrides: Record<string, unknown> = {}) =>
    ({
        ...baseTx,
        ...overrides,
        extraDataForDrawer: { ...(baseTx.extraDataForDrawer as Record<string, unknown>), ...drawerOverrides },
    }) as unknown as TransactionDetails

const downloadVisible = (transaction: TransactionDetails, isPublic = false) =>
    renderHook(() => useReceiptViewModel(transaction, { isPublic })).result.current.shouldShowDownloadPdf

describe('useReceiptViewModel — shouldShowDownloadPdf', () => {
    test('shows for completed fiat-rail receipts, in-app and public', () => {
        expect(downloadVisible(tx())).toBe(true)
        expect(downloadVisible(tx(), true)).toBe(true)
        expect(downloadVisible(tx({}, { kind: 'QR_PAY' }))).toBe(true)
    })

    test('shows for a completed sendlink (its receipt page exists) via the txHash share gate', () => {
        expect(downloadVisible(tx({ direction: 'send', txHash: '0xabc' }, { kind: 'SEND_LINK' }))).toBe(true)
    })

    test('hides for kinds without a /receipt page, even with the share gate open', () => {
        expect(downloadVisible(tx({ direction: 'send', txHash: '0xabc' }, { kind: 'DIRECT_TRANSFER' }))).toBe(false)
        expect(downloadVisible(tx({}, { kind: 'DIRECT_TRANSFER' }), true)).toBe(false)
    })

    test('hides for pre-intent pending states, matching the share affordance', () => {
        const pendingSentLink = tx(
            { status: 'pending', direction: 'send' },
            { kind: 'SEND_LINK', originalUserRole: EHistoryUserRole.SENDER }
        )
        expect(downloadVisible(pendingSentLink)).toBe(false)
        expect(downloadVisible(pendingSentLink, true)).toBe(false)

        const pendingRequester = tx(
            { status: 'pending' },
            { kind: 'P2P_REQUEST_FULFILL', originalUserRole: EHistoryUserRole.RECIPIENT }
        )
        expect(downloadVisible(pendingRequester)).toBe(false)
    })

    test('share button itself stays hidden on public receipts while download shows', () => {
        const { result } = renderHook(() => useReceiptViewModel(tx(), { isPublic: true }))
        expect(result.current.shouldShowShareReceipt).toBe(false)
        expect(result.current.shouldShowDownloadPdf).toBe(true)
    })
})
