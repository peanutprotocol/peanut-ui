/** @jest-environment jsdom */
/**
 * QR scanner case handling (TASK-21111 regression pin).
 *
 * The load-bearing claim: `processQRCode` must hand the RAW scan to
 * `recognizeQr`, never the lowercased copy it keeps for routing. Base58 chain
 * addresses carry meaning in their case — an uppercase L is a valid Solana
 * character while a lowercase l is not, and every Tron address starts with an
 * uppercase T — so lowercasing first made roughly half of all Solana addresses
 * and every Tron address fall through to "Unrecognized QR code".
 *
 * `recognizeQr` itself was always correct and is covered by its own suite; only
 * the wiring in this component was wrong, so the guard has to live here.
 */
import React from 'react'
import { act, fireEvent, screen, waitFor } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'

const mockPush = jest.fn()

jest.mock('@/assets', () => ({}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/home',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    // onFeatureFlags: the chain-rollout gate subscribes to flag loads.
    default: { capture: jest.fn(), onFeatureFlags: jest.fn(() => jest.fn()) },
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: () => false,
    isAndroidNative: () => false,
    // read by underMaintenance.config's iOS cross-chain gate, which the
    // withdraw-destination check consults (removed by TASK-22250)
    isIOSNative: () => false,
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

// Capture the scan callback so a test can feed it a payload directly.
let onScan: (data: string) => Promise<{ success: boolean; error?: string }>
jest.mock('@/components/Global/QRScanner', () => ({
    __esModule: true,
    default: (props: { onScan: (data: string) => Promise<{ success: boolean; error?: string }> }) => {
        onScan = props.onScan
        return null
    },
}))

import QRScannerOverlay from '../index'
import { SCAN_ID_PARAM, takeScannedDestination } from '@/features/withdraw/destination'

// Real, publicly known addresses. The Solana one holds an uppercase L, the
// character that a `.toLowerCase()` turns into the one letter base58 excludes.
const SOLANA_WITH_UPPERCASE_L = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const TRON = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC'
const EVM_CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
// EIP-55 says case only carries a checksum when the address is neither all-lower
// nor all-upper, so this one is valid and must survive.
const EVM_UPPERCASE = '0X5AAEB6053F3E94C9B9A09F33669435E7EF1BEAED'
// Mixed case, so the checksum is real — and wrong. viem must keep rejecting it.
const EVM_BAD_CHECKSUM = '0xAbCdEf1234567890123456789012345678901234'
const BECH32_UPPERCASE = 'BC1QAR0SRRR7XFKVY5L643LYDNW9RE59GTZZWF5MDQ'
const BOLT11_UPPERCASE = 'LNBC1230N1PJJ2LX9PP5ABC123'
// Holds an `O`, which base58 excludes — so it is not an address, and the
// lowercased retry must not turn it into one.
const SOLANA_ONLY_AFTER_LOWERCASING = 'SO11111111111111111111111111111111111111112'

const scan = async (data: string) => {
    renderWithIntl(<QRScannerOverlay />)
    await act(async () => {
        await onScan(data)
    })
}

describe('QRScannerOverlay case handling', () => {
    beforeEach(() => {
        mockPush.mockClear()
    })

    describe('base58 addresses — case is data, so recognize the raw scan', () => {
        it('recognizes a Solana address whose case a lowercase pass would destroy', async () => {
            await scan(SOLANA_WITH_UPPERCASE_L)
            expect(screen.getByText('Payment Confirmation')).toBeInTheDocument()
            expect(screen.queryByText('Unrecognized QR code')).not.toBeInTheDocument()
        })

        it('recognizes a Tron address, which always starts with an uppercase T', async () => {
            await scan(TRON)
            expect(screen.getByText('Tron not supported yet.')).toBeInTheDocument()
        })

        // TASK-22251 opened Solana only. Tron, Bitcoin and XRP keep the
        // notify-me path until each is opened on purpose.
        it('routes a Solana scan into the crypto withdrawal, address case intact', async () => {
            await scan(SOLANA_WITH_UPPERCASE_L)
            fireEvent.click(screen.getByRole('checkbox'))
            fireEvent.click(screen.getByRole('button', { name: 'Continue' }))

            const pushed = mockPush.mock.calls.at(-1)?.[0] as string
            const params = new URLSearchParams(pushed.split('?')[1])
            expect(pushed.split('?')[0]).toBe('/withdraw')
            // the amount step, on the crypto rail — method selection is implied
            expect(params.get('step')).toBe('amount')
            expect(params.get('method')).toBe('crypto')
            // the address goes in process, never in the URL PostHog records
            expect(pushed).not.toContain(SOLANA_WITH_UPPERCASE_L)
            expect(takeScannedDestination(params.get(SCAN_ID_PARAM))).toEqual({
                address: SOLANA_WITH_UPPERCASE_L,
                chainId: 'solana',
            })
        })
    })

    describe('all-uppercase payloads — QR alphanumeric mode uppercases, so retry lowercased', () => {
        it('accepts an uppercase EVM address', async () => {
            await scan(EVM_UPPERCASE)
            expect(screen.getByText('Payment Confirmation')).toBeInTheDocument()
        })

        it('accepts an uppercase bech32 Bitcoin address', async () => {
            await scan(BECH32_UPPERCASE)
            expect(screen.getByText('Bitcoin not supported yet.')).toBeInTheDocument()
        })

        it('accepts an uppercase Lightning invoice', async () => {
            await scan(BOLT11_UPPERCASE)
            expect(screen.getByText('Bitcoin not supported yet.')).toBeInTheDocument()
        })

        // ...but NOT for base58, where the retry invents an address. This payload
        // fails raw recognition because it holds an `O`, which base58 excludes;
        // lowercasing turns it into a legal `o` and a different account, which
        // nobody controls. Harmless while Solana was refused, a wrong payout
        // address now that it is paid.
        it('refuses an uppercase payload that only looks like Solana once lowercased', async () => {
            await scan(SOLANA_ONLY_AFTER_LOWERCASING)
            expect(screen.getByText('Unrecognized QR code')).toBeInTheDocument()
            expect(screen.queryByText('Payment Confirmation')).not.toBeInTheDocument()
            expect(mockPush).not.toHaveBeenCalled()
        })
    })

    describe('mixed case — the case is the user’s, so it must be honoured', () => {
        it('accepts a checksummed EVM address', async () => {
            await scan(EVM_CHECKSUMMED)
            expect(screen.getByText('Payment Confirmation')).toBeInTheDocument()
        })

        it('rejects an EVM address with a bad EIP-55 checksum rather than laundering it', async () => {
            await scan(EVM_BAD_CHECKSUM)
            expect(screen.getByText('Unrecognized QR code')).toBeInTheDocument()
            expect(screen.queryByText('Payment Confirmation')).not.toBeInTheDocument()
        })
    })

    it('still routes a Peanut URL', async () => {
        await scan('https://peanut.example.org/satoshi')
        await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/satoshi'))
    })
})

describe('direct-send acknowledgement gate', () => {
    const continueButton = () => screen.getByRole('button', { name: 'Continue' })

    it('keeps Continue disabled until the box is ticked, and starts a new scan unticked', async () => {
        renderWithIntl(<QRScannerOverlay />)
        await act(async () => {
            await onScan(EVM_CHECKSUMMED)
        })
        expect(screen.getByText('Payment Confirmation')).toBeInTheDocument()
        expect(continueButton()).toBeDisabled()

        fireEvent.click(screen.getByRole('checkbox'))
        expect(screen.getByRole('checkbox')).toBeChecked()
        expect(continueButton()).toBeEnabled()

        // second scan on the same overlay: the acknowledgement must not carry over
        await act(async () => {
            await onScan(EVM_UPPERCASE)
        })
        expect(screen.getByRole('checkbox')).not.toBeChecked()
        expect(continueButton()).toBeDisabled()
    })
})

describe('QR scan analytics privacy', () => {
    it.each([
        'private-user@example.test',
        'https://peanut.example.org/claim?id=42#p=s3cret',
        'cHJpdmF0ZS1wYXltZW50'.repeat(22) + 'AAAA',
        '0002010102110015com.mercadopagoPRIVATE53030325802AR',
        `Send to ${EVM_CHECKSUMMED} please`,
    ])('keeps scanned payloads out of every emitted event: %s', async (payload) => {
        const posthog = (await import('posthog-js')).default
        jest.mocked(posthog.capture).mockClear()
        await scan(payload)
        expect(posthog.capture).toHaveBeenCalled()
        for (const [event, properties] of jest.mocked(posthog.capture).mock.calls) {
            expect(event).toBe('qr_scanned')
            expect(Object.keys(properties ?? {}).sort()).toEqual(['qrKind', 'qrLengthBucket', 'qr_type'])
            expect(JSON.stringify(properties)).not.toContain(payload)
            expect(JSON.stringify(properties)).not.toContain(EVM_CHECKSUMMED.toLowerCase())
        }
    })
})
