import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { PrivateReceiptPdfActions } from '../PrivateReceiptPdfActions'
import { isCapacitor } from '@/utils/capacitor'
import { downloadBlob } from '@/components/Card/share-asset/captureShareAsset'
import { CapacitorHttp } from '@capacitor/core'

const mockToastError = jest.fn()
const mockToastInfo = jest.fn()

jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: mockToastError, info: mockToastInfo }),
}))
jest.mock('@/utils/auth-token', () => ({
    authReady: jest.fn().mockResolvedValue(undefined),
    getAuthHeaders: jest.fn(() => ({ Authorization: 'Bearer owner-token' })),
}))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn().mockReturnValue(false),
    isIOSNative: jest.fn().mockReturnValue(false),
    isAndroidNative: jest.fn().mockReturnValue(false),
    isLegacyWebKit: jest.fn().mockReturnValue(false),
}))
jest.mock('@/components/Card/share-asset/captureShareAsset', () => ({ downloadBlob: jest.fn() }))
jest.mock('@capacitor/core', () => ({
    CapacitorHttp: { request: jest.fn() },
}))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const mockIsCapacitor = isCapacitor as jest.Mock
const mockDownloadBlob = downloadBlob as jest.Mock
const mockNativeRequest = CapacitorHttp.request as jest.Mock

describe('PrivateReceiptPdfActions', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsCapacitor.mockReturnValue(false)
        global.fetch = jest.fn().mockResolvedValue({
            ok: true,
            status: 200,
            blob: jest.fn().mockResolvedValue(new Blob(['%PDF-private'], { type: 'application/pdf' })),
            headers: { get: () => 'inline; filename="private-receipt.pdf"' },
        })
    })

    test('prefetches with bearer auth and exposes share/download for a private kind', async () => {
        render(
            <IntlWrapper>
                <PrivateReceiptPdfActions entryId="entry-private" kind="DIRECT_TRANSFER" />
            </IntlWrapper>
        )

        const share = screen.getByRole('button', { name: 'Share Receipt' })
        const download = screen.getByRole('button', { name: 'Download Receipt (PDF)' })
        await waitFor(() => expect(share).toBeEnabled())
        expect(download).toBeEnabled()
        expect(global.fetch).toHaveBeenCalledWith(
            '/receipt/entry-private/pdf?kind=DIRECT_TRANSFER&locale=en',
            expect.objectContaining({ headers: { Authorization: 'Bearer owner-token' }, cache: 'no-store' })
        )

        fireEvent.click(share)
        await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'private-receipt.pdf'))
        expect(mockToastInfo).toHaveBeenCalled()
    })

    test('uses native HTTP for the authenticated binary without opening public CORS', async () => {
        mockIsCapacitor.mockReturnValue(true)
        mockNativeRequest.mockResolvedValue({
            status: 200,
            data: btoa('%PDF-native'),
            headers: { 'content-disposition': 'inline; filename="native-receipt.pdf"' },
        })

        render(
            <IntlWrapper>
                <PrivateReceiptPdfActions entryId="entry-native" kind="CARD_SPEND_CLEAR" />
            </IntlWrapper>
        )

        await waitFor(() =>
            expect(mockNativeRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    method: 'GET',
                    headers: { Authorization: 'Bearer owner-token' },
                    responseType: 'arraybuffer',
                })
            )
        )
        expect(global.fetch).not.toHaveBeenCalled()
        expect(await screen.findByRole('button', { name: 'Download Receipt (PDF)' })).toBeEnabled()
    })

    test('retries when the initial PDF prefetch fails', async () => {
        const response = {
            ok: true,
            status: 200,
            blob: jest.fn().mockResolvedValue(new Blob(['%PDF-retry'], { type: 'application/pdf' })),
            headers: { get: () => 'inline; filename="retried-receipt.pdf"' },
        }
        ;(global.fetch as jest.Mock)
            .mockRejectedValueOnce(new Error('temporary outage'))
            .mockResolvedValueOnce(response)

        render(
            <IntlWrapper>
                <PrivateReceiptPdfActions entryId="entry-retry" kind="DIRECT_TRANSFER" />
            </IntlWrapper>
        )

        const download = screen.getByRole('button', { name: 'Download Receipt (PDF)' })
        await waitFor(() => expect(download).toBeEnabled())
        fireEvent.click(download)

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'retried-receipt.pdf'))
        expect(mockToastError).not.toHaveBeenCalled()
    })
})
