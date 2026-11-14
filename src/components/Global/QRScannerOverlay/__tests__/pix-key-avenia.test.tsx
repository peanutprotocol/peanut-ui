/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * A user whose Pix withdraw route is Avenia's (TASK-24947), resident of Brazil or not: a bare Pix
 * key scanned or pasted is a send on the Pix-key form, its key in the draft and never in the URL. A
 * merchant's Pix code keeps the pay route: closed for a resident, Manteca's QR for everyone else.
 */
import React from 'react'
import { render, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { DEMO_PIX_BR_CODE } from '@/constants/demo-data'
import type { QRScanHandler } from '@/components/Global/QRScanner/useQRScanner'

const mockPush = jest.fn()
let capturedOnScan: QRScanHandler | undefined

jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    openExternalUrl: jest.fn(),
}))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn().mockResolvedValue(null) }))
jest.mock('posthog-js', () => ({ __esModule: true, default: { capture: jest.fn() } }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/hooks/useAppHaptic', () => ({ useAppHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@/hooks/useNotifications', () => ({ offerPushPrompt: jest.fn() }))
jest.mock('@/components/0_Bruddle/Toast', () => ({
    useToast: () => ({ error: jest.fn(), info: jest.fn(), success: jest.fn() }),
}))
const AVENIA_WITHDRAW = { operation: 'withdraw', method: 'PIX_BR', provider: 'avenia', state: 'ready' }
const RESIDENT_PAY = {
    operation: 'pay',
    method: 'PIX_BR',
    provider: null,
    state: 'refused',
    reason: { code: 'residence_not_served' },
}
const NON_RESIDENT_PAY = { operation: 'pay', method: 'PIX_BR', provider: 'manteca', state: 'ready' }
let mockRoutes: unknown[] = []
jest.mock('@/context/authContext', () => ({
    useAuth: () => ({
        user: {
            user: { userId: 'demo-user' },
            capabilities: { rails: [], nextActions: [], restrictions: [], routes: mockRoutes },
        },
    }),
}))
jest.mock('@/context/ModalsContext', () => ({
    useModalsContext: () => ({ isQRScannerOpen: true, setIsQRScannerOpen: jest.fn() }),
}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/home',
    useSearchParams: () => new URLSearchParams(),
}))
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

describe.each([
    ['a resident of Brazil', RESIDENT_PAY],
    ['a non-resident', NON_RESIDENT_PAY],
])('a Pix key scanned by %s on Avenia', (_who, payRoute) => {
    beforeEach(() => {
        mockRoutes = [payRoute, AVENIA_WITHDRAW]
    })

    it('opens the Pix-key form as a send, with the key in the draft and not in the URL', async () => {
        await scan('11144477735')
        expect(mockPush).toHaveBeenCalledWith('/withdraw/pix?sendMethod=bank')
        expect(JSON.parse(window.sessionStorage.getItem('pix-withdraw-draft:demo-user')!)).toMatchObject({
            destination: '11144477735',
        })
        expect(brazilPausedDrawerBlock()).toBeNull()
    })
})

describe("a merchant's Pix code keeps the pay route", () => {
    it('stays closed for a resident of Brazil, with the residence words', async () => {
        mockRoutes = [RESIDENT_PAY, AVENIA_WITHDRAW]
        await scan(DEMO_PIX_BR_CODE)
        expect(brazilPausedDrawerBlock()).toBe('residence')
        expect(mockPush).not.toHaveBeenCalled()
    })

    it("opens Manteca's QR payment for a non-resident", async () => {
        mockRoutes = [NON_RESIDENT_PAY, AVENIA_WITHDRAW]
        await scan(DEMO_PIX_BR_CODE)
        expect(mockPush.mock.calls.at(-1)?.[0]).toMatch(/^\/qr-pay\?/)
    })
})

describe('a user on Manteca keeps the QR payment for a key', () => {
    it('sends a scanned key through /qr-pay, as before', async () => {
        mockRoutes = [NON_RESIDENT_PAY, { ...AVENIA_WITHDRAW, provider: 'manteca' }]
        await scan('11144477735')
        expect(mockPush.mock.calls.at(-1)?.[0]).toMatch(/^\/qr-pay\?/)
        expect(window.sessionStorage.getItem('pix-withdraw-draft:demo-user')).toBeNull()
    })
})
