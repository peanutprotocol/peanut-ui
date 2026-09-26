/** @jest-environment jsdom */
/**
 * A typed Argentine payment alias reaches the scanner through paste as well as
 * through the camera. It must get the merchant-QR guidance before ENS
 * classification or the generic external-link branch, and cost no lookup.
 */
import React from 'react'
import { render, screen, act } from '@testing-library/react'
import { IntlWrapper } from '@/test-utils/intl'
import { resolveEns } from '@/app/actions/ens'
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
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: null }) }))
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

describe('typed Argentine alias pasted or scanned', () => {
    it.each([
        ['CASA.FUTBOLERA', 'uppercase, as a QR encoder emits it'],
        ['casa.futbolera', 'lowercase, as a paste arrives'],
        ['mi.alias.uala', 'three labels'],
    ])('shows the merchant-QR guidance for %s (%s)', async (alias) => {
        await scan(alias)

        expect(screen.getByText("Can't pay an alias")).toBeInTheDocument()
        // Qualified: person-to-person by alias is out, merchant QR and
        // own-account withdrawal are both live.
        expect(
            screen.getByText(
                "You can't pay another person by alias. To pay a business, scan its payment QR code. To move money to your own account, use Withdraw."
            )
        ).toBeInTheDocument()
    })

    it('makes no ENS lookup and no other request', async () => {
        await scan('CASA.FUTBOLERA')

        expect(resolveEns).not.toHaveBeenCalled()
        expect(mockServerFetch).not.toHaveBeenCalled()
    })

    it('does not route the alias anywhere', async () => {
        await scan('CASA.FUTBOLERA')

        expect(mockPush).not.toHaveBeenCalled()
        expect(mockOpenExternalUrl).not.toHaveBeenCalled()
    })

    it('still resolves a real ENS name', async () => {
        ;(resolveEns as jest.Mock).mockResolvedValueOnce('0x1234567890123456789012345678901234567890')

        await scan('vitalik.eth')

        expect(resolveEns).toHaveBeenCalledWith('vitalik.eth')
        expect(screen.queryByText("Can't pay an alias")).not.toBeInTheDocument()
    })
})
