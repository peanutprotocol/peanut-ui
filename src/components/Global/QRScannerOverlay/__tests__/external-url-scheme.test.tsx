/** @jest-environment jsdom */
/**
 * A scanned "external link" may only ever be opened as http(s).
 *
 * `recognizeQr`'s URL pattern accepts a payload that already carries a scheme,
 * so `javascript:self.co?0:eval(...)` is classified as `EQrType.URL` and lands
 * in the external-link modal. `openExternalUrl` falls back to `window.open` and
 * then `window.location.assign` off-native, both of which execute a
 * `javascript:` URL as the app's own origin — so the modal must refuse anything
 * that is not http(s) rather than forward it to the browser.
 */
import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { openExternalUrl } from '@/utils/capacitor'

jest.mock('@/assets', () => ({}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
    usePathname: () => '/home',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    openExternalUrl: jest.fn(),
}))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: { user: { username: 'satoshi' } } }) }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ isQRScannerOpen: true, setIsQRScannerOpen: jest.fn() }),
}))
jest.mock('@/components/Global/QRBottomDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ title, visible, children }: { title?: string; visible: boolean; children: React.ReactNode }) =>
        visible ? (
            <div>
                <h1>{title}</h1>
                {children}
            </div>
        ) : null,
}))

let onScan: (data: string) => Promise<{ success: boolean; error?: string }>
jest.mock('@/components/Global/QRScanner', () => ({
    __esModule: true,
    default: (props: { onScan: (data: string) => Promise<{ success: boolean; error?: string }> }) => {
        onScan = props.onScan
        return null
    },
}))

import QRScannerOverlay from '../index'

const mockOpenExternalUrl = openExternalUrl as jest.Mock

// Matches the EQrType.URL pattern (scheme, a dot and a short TLD-like token)
// while remaining a working XSS payload.
const JAVASCRIPT_PAYLOAD = 'javascript:self.co?0:eval(atob(location.hash.slice(1)))'

const scan = async (data: string) => {
    renderWithIntl(<QRScannerOverlay />)
    await act(async () => {
        await onScan(data)
    })
}

describe('scanned external links', () => {
    beforeEach(() => {
        mockOpenExternalUrl.mockClear()
    })

    it('opens an ordinary https link and shows the destination', async () => {
        await scan('https://example.com/promo')
        expect(screen.getByText('https://example.com/promo')).toBeInTheDocument()

        fireEvent.click(screen.getByRole('button', { name: 'Open link' }))
        expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://example.com/promo')
    })

    it('upgrades a scheme-less payload to https rather than letting Browser.open throw', async () => {
        await scan('example.com/promo')
        fireEvent.click(screen.getByRole('button', { name: 'Open link' }))
        expect(mockOpenExternalUrl).toHaveBeenCalledWith('https://example.com/promo')
    })

    it('refuses a javascript: payload instead of handing it to the browser', async () => {
        await scan(JAVASCRIPT_PAYLOAD)
        expect(screen.getByText('Unrecognized QR code')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open link' })).not.toBeInTheDocument()
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    })

    /**
     * Every way a payload can look like a link without parsing as an http(s) one.
     * The first four dodge the scheme test rather than fail it — whitespace and
     * control characters inside the scheme, or a spelling the regex never
     * anticipated — and the last two parse to no host at all, which the old
     * "starts with https://" check waved through as a link worth offering.
     */
    it.each([
        ['leading whitespace before the scheme', '  javascript:self.co?0:alert(1)'],
        ['a newline inside the scheme', 'java\nscript:self.co'],
        ['a tab inside the scheme', 'java\tscript:self.co'],
        ['mixed case', 'JaVaScRiPt:self.co?0:alert(1)'],
        ['a data: document', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=='],
        ['no host to visit', 'https://#x.co'],
        ['an unparseable host', '%.co'],
    ])('refuses a payload with %s', async (_label, payload) => {
        await scan(payload)
        expect(screen.getByText('Unrecognized QR code')).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: 'Open link' })).not.toBeInTheDocument()
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    })
})
