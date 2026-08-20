/** @jest-environment jsdom */
/**
 * QRScanner clipboard shortcut — platform split (PEANUT-UI-PYW regression pin).
 *
 * The load-bearing claim: `Clipboard.read()` must NEVER run at scanner open
 * off Android-native. An un-gestured read raises the iOS "Allow Paste" alert,
 * which raced (and blocked) the camera permission dialog. iOS native only
 * probes prompt-free `hasStrings` and reads on the chip TAP; web/PWA does
 * neither.
 */
import React from 'react'
import { render as rtlRender, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { Clipboard } from '@capacitor/clipboard'
import { clipboardHasStrings } from '@/utils/clipboard-detect'
import { isAndroidNative } from '@/utils/capacitor'

const mockToastError = jest.fn()

jest.mock('@capacitor/clipboard', () => ({ Clipboard: { read: jest.fn() } }))
jest.mock('@/utils/clipboard-detect', () => ({ clipboardHasStrings: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({ isAndroidNative: jest.fn() }))
// general.utils transitively imports env-requiring constants; passthrough keeps
// the chip text assertable as the full address.
jest.mock('@/utils/general.utils', () => ({ printableAddress: (a: string) => a }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: mockToastError, info: jest.fn() }),
}))
jest.mock('next/image', () => ({
    __esModule: true,
    default: (props: { alt?: string }) => <img alt={props.alt ?? ''} />,
}))
// Stands in for the real modal's paste CTA: the modal owns the whole screen in
// the denied state, so paste is only reachable if it is rendered inside it.
jest.mock('../CameraPermissionModal', () => ({
    __esModule: true,
    default: ({ onPaste }: { onPaste?: () => void }) =>
        onPaste ? <button onClick={onPaste}>{'Click to paste'}</button> : null,
}))
const cameraState = { error: null as string | null, isPermissionDenied: false }
jest.mock('../useQRScanner', () => ({
    useQRScanner: () => ({
        ...cameraState,
        isScanning: true,
        isCameraReady: true,
        videoRef: { current: null },
        close: jest.fn(),
        toggleCamera: jest.fn(),
        retryCamera: jest.fn(),
    }),
}))

import QRScanner from '../index'
import { QR_DRAWER_PASTE_GAP_PX, QR_DRAWER_PEEK_PX } from '@/constants/qr-drawer.consts'

const render = (ui: React.ReactElement, options?: Omit<Parameters<typeof rtlRender>[1], 'wrapper'>) =>
    rtlRender(ui, { wrapper: IntlWrapper, ...options })

const mockRead = Clipboard.read as jest.MockedFunction<typeof Clipboard.read>
const mockHasStrings = clipboardHasStrings as jest.MockedFunction<typeof clipboardHasStrings>
const mockIsAndroidNative = isAndroidNative as jest.MockedFunction<typeof isAndroidNative>

// all-lowercase: viem isAddress enforces checksum on mixed-case forms
const ADDRESS = '0xab5801a7d398351b8be11c439e05c5b3259aec9b'
const CHIP_LABEL = 'Use copied code'
// a Pix "copia e cola" payload — the pasted-payment shape the chip used to refuse
const PIX_CODE =
    '00020126580014BR.GOV.BCB.PIX0136123e4567-e12b-3456-7890-123456789abc5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D'

const renderScanner = (onScan = jest.fn().mockResolvedValue({ success: true })) => {
    render(<QRScanner onScan={onScan} />)
    return onScan
}

beforeEach(() => {
    jest.clearAllMocks()
    cameraState.error = null
    cameraState.isPermissionDenied = false
})

// Pasting a Pix code needs no camera, but the paste UI used to live only inside
// the live viewfinder — so on native, where the OS camera grant is a sticky
// per-install decision, declining it removed the app's only paste entry point.
describe.each([
    ['camera permission denied', { isPermissionDenied: true, error: null as string | null }],
    ['camera unavailable', { isPermissionDenied: false, error: 'Camera unavailable' }],
])('%s: paste stays reachable', (_label, state) => {
    it('pastes a Pix code without a working camera', async () => {
        Object.assign(cameraState, state)
        mockIsAndroidNative.mockReturnValue(false)
        mockHasStrings.mockResolvedValue(false)
        mockRead.mockResolvedValue({ value: PIX_CODE, type: 'text/plain' })

        const onScan = renderScanner()

        await act(async () => {
            fireEvent.click(await screen.findByText('Click to paste'))
        })
        expect(onScan).toHaveBeenCalledWith(PIX_CODE)
    })
})

it('web/PWA: never reads the clipboard at open and shows no chip', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(false)

    renderScanner()

    await waitFor(() => expect(mockHasStrings).toHaveBeenCalledTimes(1))
    expect(mockRead).not.toHaveBeenCalled()
    expect(screen.queryByText(CHIP_LABEL)).toBeNull()
})

it('iOS native: probes hasStrings only at open; the read happens on chip tap', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(true)
    mockRead.mockResolvedValue({ value: ADDRESS, type: 'text/plain' })

    const onScan = renderScanner()

    const chip = await screen.findByText(CHIP_LABEL)
    expect(mockRead).not.toHaveBeenCalled() // the PYW pin: no read before the tap

    await act(async () => {
        fireEvent.click(chip)
    })
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(onScan).toHaveBeenCalledWith(ADDRESS)
})

it('iOS native: the chip hands a pasted Pix code straight to the scan path', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(true)
    mockRead.mockResolvedValue({ value: PIX_CODE, type: 'text/plain' })

    const onScan = renderScanner()

    const chip = await screen.findByText(CHIP_LABEL)
    await act(async () => {
        fireEvent.click(chip)
    })
    // hasStrings cannot say WHAT was copied, so the chip must not filter on
    // evmAddress — that refused every Pix copia-e-cola as "not a wallet address"
    expect(onScan).toHaveBeenCalledWith(PIX_CODE)
    expect(mockToastError).not.toHaveBeenCalled()
})

it('"Click to paste": a pasted Pix code reaches onScan verbatim', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(false)
    mockRead.mockResolvedValue({ value: PIX_CODE, type: 'text/plain' })

    const onScan = renderScanner()

    await act(async () => {
        fireEvent.click(await screen.findByText('Click to paste'))
    })
    expect(onScan).toHaveBeenCalledWith(PIX_CODE)
})

it('Android native: keeps the read-at-open address preview', async () => {
    mockIsAndroidNative.mockReturnValue(true)
    mockRead.mockResolvedValue({ value: ADDRESS, type: 'text/plain' })

    renderScanner()

    expect(await screen.findByText(ADDRESS)).toBeTruthy()
    expect(mockRead).toHaveBeenCalledTimes(1)
    expect(mockHasStrings).not.toHaveBeenCalled()
})

it('chip tap: onScan failure is not misreported as a clipboard error', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(true)
    mockRead.mockResolvedValue({ value: ADDRESS, type: 'text/plain' })

    const onScan = jest.fn().mockRejectedValue(new Error('routing exploded'))
    renderScanner(onScan)

    const chip = await screen.findByText(CHIP_LABEL)
    await act(async () => {
        fireEvent.click(chip)
    })
    expect(mockToastError).toHaveBeenCalledWith('Error processing QR code')
    expect(mockToastError).not.toHaveBeenCalledWith('Could not access clipboard')
})

it('"Click to paste": onScan failure is not misreported as a clipboard error', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(false)
    mockRead.mockResolvedValue({ value: 'some text', type: 'text/plain' })

    const onScan = jest.fn().mockRejectedValue(new Error('routing exploded'))
    renderScanner(onScan)

    const paste = await screen.findByText('Click to paste')
    await act(async () => {
        fireEvent.click(paste)
    })
    expect(onScan).toHaveBeenCalledWith('some text')
    expect(mockToastError).toHaveBeenCalledWith('Error processing QR code')
    expect(mockToastError).not.toHaveBeenCalledWith('Could not access clipboard')
})

it('Android chip: onScan failure surfaces a processing error instead of rejecting unhandled', async () => {
    mockIsAndroidNative.mockReturnValue(true)
    mockRead.mockResolvedValue({ value: ADDRESS, type: 'text/plain' })

    const onScan = jest.fn().mockRejectedValue(new Error('routing exploded'))
    renderScanner(onScan)

    const chip = await screen.findByText(ADDRESS)
    await act(async () => {
        fireEvent.click(chip)
    })
    expect(onScan).toHaveBeenCalledWith(ADDRESS)
    expect(mockToastError).toHaveBeenCalledWith('Error processing QR code')
})

it('chip tap: empty clipboard maps to the same copy as "Click to paste"', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(true)
    mockRead.mockRejectedValue(new Error('There is no data on the clipboard'))

    renderScanner()

    const chip = await screen.findByText(CHIP_LABEL)
    await act(async () => {
        fireEvent.click(chip)
    })
    expect(mockToastError).toHaveBeenCalledWith('Clipboard is empty')
    await waitFor(() => expect(screen.queryByText(CHIP_LABEL)).toBeNull())
})

/*
 * The bug this pins: the paste link used to be positioned from the top of the
 * viewport while the My QR drawer's collapsed peek grew from the bottom, so the
 * drawer covered the link on short screens and in locales whose drawer text
 * wraps. The link is now anchored to the peek instead. jsdom has no layout, so
 * the geometry itself was verified in a browser — what is worth pinning here is
 * the coupling: the offset must be DERIVED from the drawer's exported peek, so
 * changing the peek can never silently leave the link behind.
 */
it('paste actions are anchored a fixed gap above the drawer peek', async () => {
    mockIsAndroidNative.mockReturnValue(false)
    mockHasStrings.mockResolvedValue(false)

    renderScanner()

    const link = await screen.findByText('Click to paste')
    const anchored = link.closest('[style*="bottom"]') as HTMLElement | null
    expect(anchored).not.toBeNull()
    expect(anchored!.style.bottom).toBe(`${QR_DRAWER_PEEK_PX + QR_DRAWER_PASTE_GAP_PX}px`)
    // fixed to the viewport, not to the scan square
    expect(anchored!.className).toContain('fixed')
})
