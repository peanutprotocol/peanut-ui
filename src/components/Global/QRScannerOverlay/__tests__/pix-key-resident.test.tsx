/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * A resident of Brazil whose withdraw route on Pix is open (Bridge, TASK-24910): a bare Pix key
 * pasted or scanned is a send on the Pix-key form, its key in the draft and never in the URL. A
 * merchant's Pix code stays closed: no withdraw route pays one.
 */
import React from 'react'
import { render, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { DEMO_PIX_BR_CODE } from '@/constants/demo-data'
import type { QRScanHandler } from '@/components/Global/QRScanner/useQRScanner'

const mockPush = jest.fn()
const mockServerFetch = jest.fn()
const mockOpenExternalUrl = jest.fn()

let capturedOnScan: QRScanHandler | undefined

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    openExternalUrl: (...args: unknown[]) => mockOpenExternalUrl(...args),
}))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: (...args: unknown[]) => mockServerFetch(...args) }))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn().mockResolvedValue(null) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn() }),
}))
// the pay route refuses the residence; the withdraw route serves it
const RESIDENT = {
    user: { userId: 'demo-user' },
    capabilities: {
        rails: [],
        nextActions: [],
        restrictions: [],
        routes: [
            {
                operation: 'pay',
                method: 'PIX_BR',
                provider: null,
                state: 'refused',
                reason: { code: 'residence_not_served' },
            },
            { operation: 'withdraw', method: 'PIX_BR', provider: 'bridge', state: 'ready' },
        ],
    },
}
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: RESIDENT }) }))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ isQRScannerOpen: true, setIsQRScannerOpen: jest.fn() }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/home',
    useSearchParams: () => new URLSearchParams(),
}))
// Passthrough instead of null: the assertion is on the copy the modal shows.
jest.mock('@/components/Global/Modal', () => ({
    __esModule: true,
    default: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
        visible ? <div>{children}</div> : null,
}))
jest.mock('@/components/Global/QRBottomDrawer', () => ({ __esModule: true, default: () => null }))
jest.mock('@/components/Global/QRScanner', () => ({
    __esModule: true,
    default: ({ onScan }: { onScan: QRScanHandler }) => {
        capturedOnScan = onScan
        return null
    },
}))

import QRScannerOverlay from '../index'
import { brazilPausedDrawerBlock, closeBrazilPausedDrawer } from '@/features/brazil-pause/brazil-paused-drawer-store'

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
    closeBrazilPausedDrawer()
    window.sessionStorage.clear()
})

describe('a Pix scan by a resident of Brazil whose withdraw route is open', () => {
    it('opens the Pix-key form as a send, with the key in the draft and not in the URL', async () => {
        await scan('11144477735')
        expect(mockPush).toHaveBeenCalledWith('/withdraw/pix?sendMethod=bank')
        expect(JSON.parse(window.sessionStorage.getItem('pix-withdraw-draft:demo-user')!)).toMatchObject({
            destination: '11144477735',
        })
        expect(brazilPausedDrawerBlock()).toBeNull()
    })

    it("keeps a merchant's Pix code closed, with the residence words", async () => {
        await scan(DEMO_PIX_BR_CODE)
        expect(brazilPausedDrawerBlock()).toBe('residence')
        expect(mockPush).not.toHaveBeenCalled()
    })
})
