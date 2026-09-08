/** @jest-environment jsdom */
/**
 * Save-button routing. On web the PNG goes through a download anchor; in the
 * native app WKWebView cancels `<a download>` silently, so Save uses the OS
 * share sheet (which carries "Save Image") and is hidden when files can't be
 * shared at all. The SAVED event only fires once the chosen path resolved.
 */
import React, { type ComponentProps, createRef } from 'react'
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

type ActionProps = Partial<ComponentProps<typeof ShareAssetActions>>

function renderActions(props: ActionProps = {}) {
    const captureRef = createRef<HTMLDivElement>()
    Object.defineProperty(captureRef, 'current', { value: document.createElement('div'), writable: true })
    const element = (p: ActionProps) => (
        <ShareAssetActions captureRef={captureRef} source="celebration" filename="card.png" {...p} />
    )
    const result = renderWithIntl(element(props))
    // same captureRef across rerenders, so prop flips exercise the cache keying
    return { ...result, rerenderActions: (p: ActionProps) => result.rerender(element(p)) }
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
        // pre-capture briefly disables native save; wait for the cache
        await waitFor(() => expect(saveButton()).toBeEnabled())
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
        // pre-capture briefly disables native save; wait for the cache
        await waitFor(() => expect(saveButton()).toBeEnabled())
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
        // pre-capture briefly disables native save; wait for the cache
        await waitFor(() => expect(saveButton()).toBeEnabled())
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
        // pre-capture briefly disables native save; wait for the cache
        await waitFor(() => expect(saveButton()).toBeEnabled())
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

/**
 * Gesture-window regression guard (TASK-22407): on iOS `navigator.share()`
 * must run inside the tap gesture, so the PNG is pre-captured when the asset
 * is ready and the tap uses the cached blob — no capture between tap and
 * share. If pre-capture failed, the tap falls back to capture-then-share.
 */
describe('ShareAssetActions share pre-capture', () => {
    const shareButton = () => screen.getByRole('button', { name: 'Share' })

    beforeEach(() => {
        jest.clearAllMocks()
        mockIsNativeBridge.mockReturnValue(false)
        mockCanShareImageFiles.mockReturnValue(true)
        mockCaptureShareAsset.mockImplementation(() => Promise.resolve(new Blob(['png'], { type: 'image/png' })))
        Object.defineProperty(navigator, 'share', { value: mockShare, configurable: true, writable: true })
    })

    it('shares the pre-captured PNG without capturing inside the tap', async () => {
        renderActions()
        // pre-capture fires on mount (ready defaults true); the button
        // enables once the blob is cached
        await waitFor(() => expect(mockCaptureShareAsset).toHaveBeenCalledTimes(1))
        await waitFor(() => expect(shareButton()).toBeEnabled())
        fireEvent.click(shareButton())
        await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1))
        // the tap did NOT trigger a second capture — it used the cached blob
        expect(mockCaptureShareAsset).toHaveBeenCalledTimes(1)
        const [{ files }] = mockShare.mock.calls[0] as unknown as [{ files: File[] }]
        expect(files[0].name).toBe('card.png')
        expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
            source: 'celebration',
            method: 'native-share-with-file',
            link_type: 'none',
        })
    })

    it('falls back to capture-on-tap when pre-capture failed', async () => {
        mockCaptureShareAsset.mockImplementationOnce(() => Promise.reject(new Error('precapture broke')))
        renderActions()
        await waitFor(() => expect(mockCaptureShareAsset).toHaveBeenCalledTimes(1))
        // failure re-enables the button — the tap is the retry path
        await waitFor(() => expect(shareButton()).toBeEnabled())
        fireEvent.click(shareButton())
        await waitFor(() => expect(mockShare).toHaveBeenCalledTimes(1))
        // no cached blob, so the tap captured again — share still works
        expect(mockCaptureShareAsset).toHaveBeenCalledTimes(2)
        expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    })

    it('disables Share while pre-capture is pending and enables once cached', async () => {
        let resolveCapture!: (blob: Blob) => void
        mockCaptureShareAsset.mockImplementationOnce(() => new Promise<Blob>((resolve) => (resolveCapture = resolve)))
        renderActions()
        // a tap here would miss the cache and reproduce the gesture-window bug
        expect(shareButton()).toBeDisabled()
        resolveCapture(new Blob(['png'], { type: 'image/png' }))
        await waitFor(() => expect(shareButton()).toBeEnabled())
    })

    it('re-enables the buttons when pre-capture fails', async () => {
        let rejectCapture!: (err: Error) => void
        mockCaptureShareAsset.mockImplementationOnce(() => new Promise<Blob>((_, reject) => (rejectCapture = reject)))
        renderActions()
        expect(shareButton()).toBeDisabled()
        rejectCapture(new Error('precapture broke'))
        // never leave the buttons dead — capture-on-tap is the retry path
        await waitFor(() => expect(shareButton()).toBeEnabled())
    })

    it('hide-username toggle re-captures even when shareUrl is undefined in both states (no handle)', async () => {
        const { rerenderActions } = renderActions({ hideUsername: false, shareUrl: undefined })
        await waitFor(() => expect(mockCaptureShareAsset).toHaveBeenCalledTimes(1))
        rerenderActions({ hideUsername: true, shareUrl: undefined })
        await waitFor(() => expect(mockCaptureShareAsset).toHaveBeenCalledTimes(2))
    })

    it('hide-username toggle re-captures for a user with a handle', async () => {
        const { rerenderActions } = renderActions({ hideUsername: false, shareUrl: 'https://peanut.me/kush' })
        await waitFor(() => expect(mockCaptureShareAsset).toHaveBeenCalledTimes(1))
        rerenderActions({ hideUsername: true, shareUrl: undefined })
        await waitFor(() => expect(mockCaptureShareAsset).toHaveBeenCalledTimes(2))
    })

    it('desktop (no file sharing): never pre-captures', async () => {
        mockCanShareImageFiles.mockReturnValue(false)
        renderActions()
        fireEvent.click(shareButton())
        await waitFor(() =>
            expect(mockedCapture).toHaveBeenCalledWith(ANALYTICS_EVENTS.CARD_SHARE_ASSET_SHARED, {
                source: 'celebration',
                method: 'twitter-intent-fallback',
                link_type: 'none',
            })
        )
        expect(mockCaptureShareAsset).not.toHaveBeenCalled()
    })
})
