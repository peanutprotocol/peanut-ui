/** @jest-environment jsdom */
/**
 * Save-button routing. On web the PNG goes through a download anchor; in the
 * native app WKWebView cancels `<a download>` silently, so Save uses the OS
 * share sheet (which carries "Save Image") and is hidden when files can't be
 * shared at all. The SAVED event only fires once the chosen path resolved.
 */
import React, { createRef } from 'react'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import posthog from 'posthog-js'
import { renderWithIntl } from '@/test-utils/intl'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { ShareAssetActions } from '../ShareAssetActions'

const mockIsNativeBridge = jest.fn(() => false)
jest.mock('@/utils/capacitor', () => ({
    ...jest.requireActual('@/utils/capacitor'),
    isNativeBridge: () => mockIsNativeBridge(),
}))

const mockCanShareImageFiles = jest.fn(() => false)
const mockDownloadBlob = jest.fn()
const mockCaptureShareAsset = jest.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' })))
jest.mock('../captureShareAsset', () => ({
    captureShareAsset: (...args: unknown[]) => mockCaptureShareAsset(...(args as [])),
    canShareImageFiles: () => mockCanShareImageFiles(),
    downloadBlob: (...args: unknown[]) => mockDownloadBlob(...args),
    ShareAssetCaptureError: class ShareAssetCaptureError extends Error {},
}))

jest.mock('../share.utils', () => ({ shareCardOnTwitter: jest.fn() }))
jest.mock('../winCaptions', () => ({ pickWinCaption: () => 'gg' }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))

const mockedCapture = posthog.capture as jest.Mock
const mockShare = jest.fn(() => Promise.resolve())

function renderActions() {
    const captureRef = createRef<HTMLDivElement>()
    Object.defineProperty(captureRef, 'current', { value: document.createElement('div'), writable: true })
    return renderWithIntl(<ShareAssetActions captureRef={captureRef} source="celebration" filename="card.png" />)
}

const saveButton = () => screen.getByRole('button', { name: 'Save image' })

describe('ShareAssetActions save', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        mockIsNativeBridge.mockReturnValue(false)
        mockCanShareImageFiles.mockReturnValue(false)
        Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true, writable: true })
    })

    it('web: downloads the PNG and reports saved', async () => {
        renderActions()
        fireEvent.click(saveButton())
        await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'card.png'))
        expect(mockShare).not.toHaveBeenCalled()
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SAVED, {
            source: 'celebration',
            method: 'download',
        })
    })

    it('native: hands the PNG to the share sheet and reports saved only after it resolves', async () => {
        mockIsNativeBridge.mockReturnValue(true)
        mockCanShareImageFiles.mockReturnValue(true)
        let resolveShare!: () => void
        mockShare.mockImplementationOnce(() => new Promise<void>((resolve) => (resolveShare = resolve)))
        renderActions()
        fireEvent.click(saveButton())
        await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1))
        const [{ files }] = mockShare.mock.calls[0] as unknown as [{ files: File[] }]
        expect(files).toHaveLength(1)
        expect(files[0].name).toBe('card.png')
        expect(files[0].type).toBe('image/png')
        expect(mockDownloadBlob).not.toHaveBeenCalled()
        expect(mockedCapture).not.toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SAVED, expect.anything())
        resolveShare()
        await waitFor(() =>
            expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SAVED, {
                source: 'celebration',
                method: 'native-share',
            })
        )
    })

    it('native: a dismissed share sheet is neither saved nor failed and re-enables Save', async () => {
        mockIsNativeBridge.mockReturnValue(true)
        mockCanShareImageFiles.mockReturnValue(true)
        const abort = new Error('cancelled')
        abort.name = 'AbortError'
        mockShare.mockRejectedValueOnce(abort)
        renderActions()
        fireEvent.click(saveButton())
        await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(saveButton()).toBeEnabled())
        expect(mockedCapture).not.toHaveBeenCalled()
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('native: a real share failure reports failed', async () => {
        mockIsNativeBridge.mockReturnValue(true)
        mockCanShareImageFiles.mockReturnValue(true)
        mockShare.mockRejectedValueOnce(new Error('share broke'))
        renderActions()
        fireEvent.click(saveButton())
        await waitFor(() =>
            expect(mockedCapture).toHaveBeenCalledWith(
                ANALYTICS_EVENTS.CARD_SHARE_ASSET_FAILED,
                expect.objectContaining({ source: 'celebration', action: 'save', message: 'share broke' })
            )
        )
        expect(screen.getByRole('alert')).toHaveTextContent('share broke')
    })

    it('native without file sharing: no Save button at all', () => {
        mockIsNativeBridge.mockReturnValue(true)
        mockCanShareImageFiles.mockReturnValue(false)
        renderActions()
        expect(screen.queryByRole('button', { name: 'Save image' })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
    })
})
