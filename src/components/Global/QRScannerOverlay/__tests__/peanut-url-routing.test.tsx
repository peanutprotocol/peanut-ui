/** @jest-environment jsdom */
/**
 * Scanned peanut.me links must route through the native path mapper.
 *
 * An IRL request QR encodes `https://peanut.me/<recipient>/<amount><token>?id=<uuid>`,
 * served on web by the `[...recipient]` catch-all. That route is stripped from the
 * native static export (scripts/native-build.js), so pushing the raw web path made
 * the router fall back to a full page load and the WebView landed on a localhost
 * error page — the reported "couldn't pay an IRL request from the app, but the PWA
 * worked".
 */
import React from 'react'
import { render, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { isCapacitor } from '@/utils/capacitor'
import type { QRScanHandler } from '@/components/Global/QRScanner/useQRScanner'

const mockPush = jest.fn()
const mockServerFetch = jest.fn()

let capturedOnScan: QRScanHandler | undefined

jest.mock('@/utils/capacitor', () => ({ isCapacitor: jest.fn(), openExternalUrl: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn().mockResolvedValue(null) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn() }),
}))
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ isQRScannerOpen: true, setIsQRScannerOpen: jest.fn() }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/home',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('@/components/Global/Modal', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/QRBottomDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/QRScanner', () => ({
    __esModule: true,
    default: ({ onScan }: { onScan: QRScanHandler }) => {
        capturedOnScan = onScan
        return null
    },
}))

import QRScannerOverlay from '../index'

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>

const scan = async (data: string) => {
    render(
        <IntlWrapper>
            <QRScannerOverlay />
        </IntlWrapper>
    )
    await act(async () => {
        await capturedOnScan!(data)
    })
}

beforeEach(() => {
    jest.clearAllMocks()
    capturedOnScan = undefined
})

describe('scanned peanut.me links on native', () => {
    beforeEach(() => {
        mockIsCapacitor.mockReturnValue(true)
    })

    it('routes an IRL request QR to the pay-request stand-in', async () => {
        await scan('https://peanut.me/alice/10USDC?id=req-123')
        expect(mockPush).toHaveBeenCalledWith('/pay-request?id=req-123')
    })

    it('routes a charge link to the pay-request stand-in', async () => {
        await scan('https://peanut.me/alice/10USDC?chargeId=charge-123')
        expect(mockPush).toHaveBeenCalledWith('/pay-request?chargeId=charge-123')
    })

    it('rewrites other dynamic routes to their query-param form', async () => {
        await scan('https://peanut.me/send/bob')
        expect(mockPush).toHaveBeenCalledWith('/send?recipient=bob')
    })

    it('keeps the claim password in the fragment', async () => {
        await scan('https://peanut.me/claim?c=8453&v=v4.2&i=7#p=s3cret')
        expect(mockPush).toHaveBeenCalledWith('/claim?c=8453&v=v4.2&i=7#p=s3cret')
    })

    it('leaves a static in-app route untouched', async () => {
        await scan('https://peanut.me/history')
        expect(mockPush).toHaveBeenCalledWith('/history')
    })
})

describe('scanned peanut.me links on web', () => {
    beforeEach(() => {
        mockIsCapacitor.mockReturnValue(false)
    })

    it('keeps the catch-all recipient path that the web route serves', async () => {
        await scan('https://peanut.me/alice/10USDC?id=req-123')
        expect(mockPush).toHaveBeenCalledWith('/alice/10USDC?id=req-123')
    })
})
