import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { useReceiptPdfFile } from '../useReceiptPdfFile'
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

/* the hook powers the receipt's primary share button AND the more-actions
   drawer rows (TASK-22452) — this harness stands in for both consumers. */
function Harness({ entryId, kind, prefetch = true }: { entryId: string; kind: string; prefetch?: boolean }) {
    const pdf = useReceiptPdfFile({ entryId, kind, prefetch })
    return (
        <div>
            <button disabled={pdf.unavailable || pdf.busy !== null} onClick={() => void pdf.share()}>
                share
            </button>
            <button disabled={pdf.unavailable || pdf.busy !== null} onClick={() => void pdf.download()}>
                download
            </button>
        </div>
    )
}

const renderHarness = (props: { entryId: string; kind: string; prefetch?: boolean }) =>
    render(
        <IntlWrapper>
            <Harness {...props} />
        </IntlWrapper>
    )

describe('useReceiptPdfFile', () => {
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
        renderHarness({ entryId: 'entry-private', kind: 'DIRECT_TRANSFER' })

        const share = screen.getByRole('button', { name: 'share' })
        const download = screen.getByRole('button', { name: 'download' })
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

        renderHarness({ entryId: 'entry-native', kind: 'CARD_SPEND_CLEAR' })

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
        await waitFor(() => expect(screen.getByRole('button', { name: 'download' })).toBeEnabled())
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

        renderHarness({ entryId: 'entry-retry', kind: 'DIRECT_TRANSFER' })

        const download = screen.getByRole('button', { name: 'download' })
        await waitFor(() => expect(download).toBeEnabled())
        fireEvent.click(download)

        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
        await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'retried-receipt.pdf'))
        expect(mockToastError).not.toHaveBeenCalled()
    })

    test('without prefetch nothing is fetched until an action asks for the file', async () => {
        renderHarness({ entryId: 'entry-lazy', kind: 'QR_PAY', prefetch: false })

        expect(global.fetch).not.toHaveBeenCalled()
        const download = screen.getByRole('button', { name: 'download' })
        expect(download).toBeEnabled()
        fireEvent.click(download)
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'private-receipt.pdf'))
    })
})

describe('useReceiptPdfFile — review regressions (TASK-22452)', () => {
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

    const withWebShare = () => {
        const share = jest.fn().mockResolvedValue(undefined)
        Object.assign(navigator, { share, canShare: () => true })
        return share
    }
    afterEach(() => {
        Object.assign(navigator, { share: undefined, canShare: undefined })
    })

    test('a prefetched file is handed to the share sheet synchronously from the click', async () => {
        const share = withWebShare()
        renderHarness({ entryId: 'entry-sync', kind: 'DIRECT_TRANSFER' })
        await waitFor(() => expect(screen.getByRole('button', { name: 'share' })).toBeEnabled())

        fireEvent.click(screen.getByRole('button', { name: 'share' }))
        // no awaits between the click and this assertion: the cached path
        // must reach navigator.share inside the click's user activation
        expect(share).toHaveBeenCalledTimes(1)
    })

    test('an identity switch drops the cached file and discards an in-flight fetch', async () => {
        let resolveFirst!: (value: unknown) => void
        ;(global.fetch as jest.Mock).mockImplementationOnce(() => new Promise((res) => (resolveFirst = res)))

        const view = render(
            <IntlWrapper>
                <Harness entryId="entry-old" kind="QR_PAY" prefetch={false} />
            </IntlWrapper>
        )
        fireEvent.click(screen.getByRole('button', { name: 'download' }))
        // the fetch fires after the auth-ready microtask
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))

        // the receipt changes while the old fetch is still in flight
        view.rerender(
            <IntlWrapper>
                <Harness entryId="entry-new" kind="QR_PAY" prefetch={false} />
            </IntlWrapper>
        )
        await waitFor(() => {})
        resolveFirst({
            ok: true,
            status: 200,
            blob: jest.fn().mockResolvedValue(new Blob(['%PDF-old'], { type: 'application/pdf' })),
            headers: { get: () => 'inline; filename="old-receipt.pdf"' },
        })
        await waitFor(() => expect(screen.getByRole('button', { name: 'download' })).toBeEnabled())
        // the stale file is never delivered
        expect(mockDownloadBlob).not.toHaveBeenCalled()

        // the next action fetches the NEW identity, not the cached old file
        fireEvent.click(screen.getByRole('button', { name: 'download' }))
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2))
        expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('entry-new')
        await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'private-receipt.pdf'))
    })

    test('repeated taps while an action is pending are a no-op', async () => {
        let resolveFetch!: (value: unknown) => void
        ;(global.fetch as jest.Mock).mockImplementationOnce(() => new Promise((res) => (resolveFetch = res)))
        renderHarness({ entryId: 'entry-busy', kind: 'QR_PAY', prefetch: false })

        const download = screen.getByRole('button', { name: 'download' })
        fireEvent.click(download)
        // second tap in the same tick, before busy state re-renders — the
        // busy ref makes it a no-op
        fireEvent.click(download)
        await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1))
        expect(global.fetch).toHaveBeenCalledTimes(1)

        resolveFetch({
            ok: true,
            status: 200,
            blob: jest.fn().mockResolvedValue(new Blob(['%PDF-busy'], { type: 'application/pdf' })),
            headers: { get: () => 'inline; filename="busy-receipt.pdf"' },
        })
        await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledTimes(1))
    })
})
