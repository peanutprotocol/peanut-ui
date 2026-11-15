/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * QRScanner paste button — platform split (PEANUT-UI-PYW regression pin).
 *
 * The load-bearing claim: `Clipboard.read()` must NEVER run at scanner open
 * off Android-native. An un-gestured read raises the iOS "Allow Paste" alert,
 * which raced (and blocked) the camera permission dialog. iOS native and web
 * read only on the button TAP. Android reads at open, but only to name what
 * was copied on the button; the tap reads again and pays the fresh value.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { Clipboard } from '@capacitor/clipboard'
import { isAndroidNative } from '@/utils/capacitor'
import { captureException } from '@sentry/nextjs'
import { dispatchBackPress, resetBackHandlersForTests } from '@/utils/back-handler'

const mockToastError = jest.fn()

jest.mock('@capacitor/clipboard', () => ({ Clipboard: { read: jest.fn() } }))
// isCapacitor: the DS Button's haptic asks on every tap
jest.mock('@/utils/capacitor', () => ({ isAndroidNative: jest.fn(), isCapacitor: () => false }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
// general.utils transitively imports env-requiring constants; the scanner uses none of it
jest.mock('@/utils/general.utils', () => ({}))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: mockToastError, info: jest.fn() }),
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}))
// Stands in for the real modal's paste CTA: the modal owns the whole screen in
// the denied state, so paste is only reachable if it is rendered inside it.
jest.mock('../CameraPermissionDrawer', () => ({
    __esModule: true,
    // mirrors the real contract: Try again + Dismiss, and a paste button ONLY
    // if a caller were to pass onPaste (it must not — the assertion relies on it)
    default: ({ onRetry, onClose, onPaste }: { onRetry: () => void; onClose: () => void; onPaste?: () => void }) => (
        <div>
            <button onClick={onRetry}>{'Try again'}</button>
            <button onClick={onClose}>{'Dismiss'}</button>
            {onPaste && <button onClick={onPaste}>{'Paste'}</button>}
        </div>
    ),
}))
const cameraState = { error: null as string | null, isPermissionDenied: false }
const mockClose = jest.fn()
jest.mock('../useQRScanner', () => ({
    useQRScanner: () => ({
        ...cameraState,
        isScanning: true,
        isCameraReady: true,
        videoRef: { current: null },
        close: mockClose,
        toggleCamera: jest.fn(),
        retryCamera: jest.fn(),
    }),
}))

import QRScanner from '../index'

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

const mockRead = Clipboard.read as jest.MockedFunction<typeof Clipboard.read>
const mockIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>
const mockCaptureException = captureException as jest.MockedFunction<typeof captureException>

// all-lowercase: viem isAddress enforces checksum on mixed-case forms
const ADDRESS = '0xab5801a7d398351b8be11c439e05c5b3259aec9b'
// a Pix "copia e cola" payload
const PIX_CODE =
    '00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-3456-7890-123456789abc5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D'
const PIX_PAYLOAD = '00020101021226' + '0014br.gov.bcb.pix' + 'x'.repeat(68)

const renderScanner = (onScan = jest.fn().mockResolvedValue({ success: true })) => {
    render(<QRScanner onScan={onScan} />)
    return onScan
}

beforeEach(() => {
    jest.clearAllMocks()
    resetBackHandlersForTests()
    cameraState.error = null
    cameraState.isPermissionDenied = false
})

// The camera-unavailable ERROR view keeps a paste path (pasting a Pix code
// needs no camera). The permission-denied MODAL deliberately does not any
// more: two secondary CTAs broke the modal recipe (ruled 2026-09-03, kush) —
// it offers Try again + Dismiss only. The accepted trade-off: a native user
// with a sticky camera denial pastes via the error view, not this modal.
describe('camera unavailable: paste stays reachable', () => {
    it('pastes a Pix code without a working camera', async () => {
        Object.assign(cameraState, { isPermissionDenied: false, error: 'Camera unavailable' })
        mockIsAndroidNative.mockReturnValue(false)
        mockRead.mockResolvedValue({ value: PIX_CODE, type: 'text/plain' })

        const onScan = renderScanner()

        await act(async () => {
            fireEvent.click(await screen.findByText('Paste'))
        })
        expect(onScan).toHaveBeenCalledWith(PIX_CODE)
    })
})

describe('camera permission denied: the modal keeps one primary + Dismiss', () => {
    it('offers Try again and Dismiss, and no paste CTA', async () => {
        Object.assign(cameraState, { isPermissionDenied: true, error: null })
        mockIsAndroidNative.mockReturnValue(false)

        renderScanner()

        expect(await screen.findByText('Try again')).toBeInTheDocument()
        expect(screen.getByText('Dismiss')).toBeInTheDocument()
        expect(screen.queryByText('Paste')).toBeNull()
    })
})

describe('Android hardware back', () => {
    it('closes the scanner instead of falling through to minimizeApp', async () => {
        mockIsAndroidNative.mockReturnValue(false)

        renderScanner()

        expect(dispatchBackPress()).toBe(true)
        expect(mockClose).toHaveBeenCalledTimes(1)
    })
})

const tapPaste = async (label = 'Paste') => {
    const button = await screen.findByRole('button', { name: label })
    await act(async () => {
        fireEvent.click(button)
    })
}

it('web and iOS: never reads the clipboard at open; the read happens on the tap', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockRead.mockResolvedValue({ value: ADDRESS, type: 'text/plain' })

    const onScan = renderScanner()

    await screen.findByRole('button', { name: 'Paste' })
    expect(mockRead).not.toHaveBeenCalled() // the PYW pin: no read before the tap

    await tapPaste()
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith(ADDRESS)
})

it('a pasted Pix code reaches onScan verbatim', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockRead.mockResolvedValue({ value: PIX_CODE, type: 'text/plain' })

    const onScan = renderScanner()

    await tapPaste()
    // the button must not filter by type: recognizeQr decides what is payable
    expect(onScan).toHaveBeenCalledWith(PIX_CODE)
    expect(mockToastError).not.toHaveBeenCalled()
})

it('is one enabled control, with no second paste chip', async () => {
    mockIsAndroidNative.mockReturnValue(false)

    renderScanner()

    const buttons = (await screen.findAllByRole('button')).filter((button) => /paste|copied/i.test(button.textContent!))
    expect(buttons).toHaveLength(1)
    expect(buttons[0]).toBeEnabled()
})

describe('Android native: the button names what was copied', () => {
    it('names a copied Pix code', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        mockRead.mockResolvedValue({ value: PIX_CODE, type: 'text/plain' })

        renderScanner()

        expect(await screen.findByRole('button', { name: 'Paste Pix code' })).toBeInTheDocument()
    })

    it('names a copied address', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        mockRead.mockResolvedValue({ value: ADDRESS, type: 'text/plain' })

        renderScanner()

        expect(await screen.findByRole('button', { name: 'Paste address' })).toBeInTheDocument()
    })

    it('keeps the plain label for unrelated text', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        mockRead.mockResolvedValueOnce({ value: 'milk, bread, coffee', type: 'text/plain' })

        renderScanner()

        await act(async () => {})
        expect(mockRead).toHaveBeenCalledTimes(1)
        expect(screen.getByRole('button', { name: 'Paste' })).toBeEnabled()
    })

    // The stale-value bug this replaces: the old chip paid the address read at
    // open even after the user copied something else.
    it('pays what the clipboard holds at the tap, not what it held at open', async () => {
        mockIsAndroidNative.mockReturnValue(true)
        mockRead.mockResolvedValueOnce({ value: ADDRESS, type: 'text/plain' })

        const onScan = renderScanner()
        await screen.findByRole('button', { name: 'Paste address' })

        mockRead.mockResolvedValueOnce({ value: PIX_CODE, type: 'text/plain' })
        await tapPaste('Paste address')

        expect(onScan).toHaveBeenCalledTimes(1)
        expect(onScan).toHaveBeenCalledWith(PIX_CODE)
    })
})

it('a double tap opens the payment once', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockRead.mockResolvedValue({ value: PIX_CODE, type: 'text/plain' })

    const onScan = renderScanner()

    const button = await screen.findByRole('button', { name: 'Paste' })
    await act(async () => {
        fireEvent.click(button)
        fireEvent.click(button)
    })
    expect(onScan).toHaveBeenCalledTimes(1)

    // and the guard releases: a later tap works again
    await tapPaste()
    expect(onScan).toHaveBeenCalledTimes(2)
})

it('onScan failure is not misreported as a clipboard error', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockRead.mockResolvedValue({ value: PIX_PAYLOAD, type: 'text/plain' })

    const onScan = jest.fn().mockRejectedValue(new Error('routing exploded'))
    renderScanner(onScan)

    await tapPaste()
    expect(onScan).toHaveBeenCalledWith(PIX_PAYLOAD)
    expect(mockToastError).toHaveBeenCalledWith('Error processing QR code')
    expect(mockToastError).not.toHaveBeenCalledWith('Could not access clipboard')
    // The failure stays searchable without copying the scanned value: only the
    // coarse payload family and length bucket are sent.
    expect(mockCaptureException).toHaveBeenCalledWith(
        new Error('QR scan processing failed'),
        expect.objectContaining({
            tags: { error_type: 'qr_scan_processing' },
            extra: { qrLengthBucket: '64-255', qrKind: 'pix' },
        })
    )
})

it('empty clipboard: says so and keeps the button', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockRead.mockRejectedValue(new Error('There is no data on the clipboard'))

    const onScan = renderScanner()

    await tapPaste()
    expect(mockToastError).toHaveBeenCalledWith('Clipboard is empty')
    expect(onScan).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Paste' })).toBeEnabled()
})

/*
 * The pills and the paste button hang off the scan square (top-full + mt-6),
 * not off the drawer peek. jsdom has no layout, so what is pinned here is the
 * anchoring: the group lives inside the square's container and is positioned
 * from its bottom edge.
 */
it('pills and paste button hang below the scan square', async () => {
    mockIsAndroidNative.mockReturnValue(false)

    renderScanner()

    const button = await screen.findByRole('button', { name: 'Paste' })
    const anchored = button.closest('.top-full') as HTMLElement | null
    expect(anchored).not.toBeNull()
    expect(anchored!.className).toContain('mt-6')
    expect(anchored!.className).toContain('absolute')
    // the pills come first, the button after them
    const list = screen.getByRole('list', { name: 'Supported QR codes' })
    expect(anchored).toContainElement(list)
    expect(list.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
})

describe('network pills', () => {
    const pill = (name: string) => screen.getByText(name).closest('li')!

    it('shows no visible caption: the pills are labelled for screen readers only', () => {
        mockIsAndroidNative.mockReturnValue(false)
        renderScanner()
        expect(screen.queryByText('Supported QR codes')).toBeNull()
        expect(screen.getByRole('list', { name: 'Supported QR codes' })).toBeInTheDocument()
    })

    it('are informational, not controls', () => {
        mockIsAndroidNative.mockReturnValue(false)
        renderScanner()
        for (const name of ['Peanut', 'Mercado Pago', 'Pix', 'ETH & EVMs']) {
            expect(pill(name).closest('button, a')).toBeNull()
        }
    })

    it('leaves Pix out when Pix is paused for the user', () => {
        mockIsAndroidNative.mockReturnValue(false)
        render(<QRScanner onScan={jest.fn()} hidePix />)
        expect(screen.queryByText('Pix')).not.toBeInTheDocument()
        expect(screen.getByText('Mercado Pago')).toBeInTheDocument()
    })

    // three pills: the odd last one spans both columns and centres itself, instead of hanging left
    it('centres the last of three pills on its own row', () => {
        mockIsAndroidNative.mockReturnValue(false)
        render(<QRScanner onScan={jest.fn()} hidePix />)
        const pills = ['Peanut', 'Mercado Pago', 'ETH & EVMs'].map(pill)
        expect(pills.slice(0, 2).map((item) => item.className)).not.toContainEqual(
            expect.stringContaining('col-span-2')
        )
        expect(pills[2].className).toContain('col-span-2')
        expect(pills[2].className).toContain('justify-self-center')
    })

    it('keeps four pills in the 2×2 grid, none spanning a row', () => {
        mockIsAndroidNative.mockReturnValue(false)
        renderScanner()
        for (const name of ['Peanut', 'Mercado Pago', 'Pix', 'ETH & EVMs']) {
            expect(pill(name).className).not.toContain('col-span-2')
        }
    })
})
