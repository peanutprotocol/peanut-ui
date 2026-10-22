/** @jest-environment jsdom */
jest.mock('@/utils/native-platform', () => require('@/test-utils/native-platform-mock').createNativePlatformMock())

/**
 * Where a scanned EVM destination goes (TASK-23974).
 *
 * The scanner is reachable only when signed in, and a signed-in user scanning
 * an EVM address, an ENS name or an EIP-681 request is paying out of their own
 * wallet. That is the crypto withdrawal. It used to land on the payment-request
 * page instead, whose guest funding rows bounced a signed-in user through
 * /setup to /home. A bare address names no network, so the withdrawal leaves
 * the network pick to the user. A guest, who only reaches this through a shared
 * link, keeps the payment page.
 *
 * The address is handed over in process and never in the URL: see
 * stashScannedDestination.
 */
import React from 'react'
import { act, fireEvent, screen } from '@testing-library/react'
import { renderWithIntl } from '@/test-utils/intl'
import { isCapacitor } from '@/utils/capacitor'
import { resolveEns } from '@/app/actions/ens'

const mockPush = jest.fn()

jest.mock('@/assets', () => ({}))
jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => '/home',
    useSearchParams: () => new URLSearchParams(),
}))
jest.mock('posthog-js', () => ({
    __esModule: true,
    default: { capture: jest.fn() },
}))
jest.mock('use-haptic', () => ({ useHaptic: () => ({ triggerHaptic: jest.fn() }) }))
jest.mock('@sentry/nextjs', () => ({ captureException: jest.fn() }))
jest.mock('@/app/actions/ens', () => ({ resolveEns: jest.fn() }))
jest.mock('@/utils/api-fetch', () => ({ serverFetch: jest.fn() }))
jest.mock('@/utils/capacitor', () => ({
    isCapacitor: jest.fn(() => false),
    isAndroidNative: () => false,
    openExternalUrl: jest.fn(),
}))

const mockMaintenance = { disableXchainWithdraw: false }
jest.mock('@/config/underMaintenance.config', () => ({ __esModule: true, default: mockMaintenance }))
jest.mock('@/components/0_Bruddle/Toast', () => ({ useToast: () => ({ error: jest.fn() }) }))

const SIGNED_IN = { user: { userId: 'user-1', username: 'satoshi' } }
let mockUser: typeof SIGNED_IN | null = SIGNED_IN
jest.mock('@/context/authContext', () => ({ useAuth: () => ({ user: mockUser }) }))
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
import { SCAN_ID_PARAM, clearScannedDestination, takeScannedDestination } from '@/features/withdraw/destination'

const mockIsCapacitor = isCapacitor as jest.MockedFunction<typeof isCapacitor>
const mockResolveEns = resolveEns as jest.MockedFunction<typeof resolveEns>

// A real, publicly known address. Its EIP-55 checksum is the case.
const CHECKSUMMED = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const LOWERCASE = CHECKSUMMED.toLowerCase()
const BASE_USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'
// 10 USDC (6 decimals) to the address, on Base
const EIP681_BASE_USDC = `ethereum:${BASE_USDC}@8453/transfer?address=${CHECKSUMMED}&uint256=1e7`
const NATIVE = '0x0000000000000000000000000000000000000000'
// Optimism lists two USDC contracts: native USDC and the bridged USDC.e.
const OPTIMISM_USDC = '0x0b2c639c533813f4aa9d7837caf62653d097ff85'
const OPTIMISM_BRIDGED_USDC = '0x7f5c764cbc14f9669b88837ca1490cca17c31607'
const eip681Transfer = (token: string, chainId: string) =>
    `ethereum:${token}@${chainId}/transfer?address=${CHECKSUMMED}&uint256=1e7`

/** Scan, tick the acknowledgement and press on; returns the pushed URL. */
const scanAndConfirm = async (data: string): Promise<string> => {
    renderWithIntl(<QRScannerOverlay />)
    await act(async () => {
        await onScan(data)
    })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }))
    return mockPush.mock.calls.at(-1)?.[0] as string
}

const scanOnly = async (data: string) => {
    renderWithIntl(<QRScannerOverlay />)
    await act(async () => {
        await onScan(data)
    })
}

const withdrawEntry = (pushed: string) => {
    const [path, query] = pushed.split('?')
    const params = new URLSearchParams(query)
    return { path, params, destination: takeScannedDestination(params.get(SCAN_ID_PARAM)) }
}

beforeEach(() => {
    jest.clearAllMocks()
    clearScannedDestination()
    mockUser = SIGNED_IN
    mockMaintenance.disableXchainWithdraw = false
    mockIsCapacitor.mockReturnValue(false)
})

describe('a signed-in scan of an EVM address', () => {
    describe.each([
        ['web', false],
        ['native', true],
    ])('on %s', (_platform, native) => {
        beforeEach(() => mockIsCapacitor.mockReturnValue(native))

        it.each([
            ['checksummed', CHECKSUMMED],
            ['lowercase', LOWERCASE],
        ])('goes into the crypto withdrawal with a %s address intact', async (_case, address) => {
            const { path, params, destination } = withdrawEntry(await scanAndConfirm(address))

            expect(path).toBe('/withdraw')
            expect(params.get('step')).toBe('amount')
            expect(params.get('method')).toBe('crypto')
            expect(params.toString().toLowerCase()).not.toContain(LOWERCASE)
            expect(destination).toEqual({ address })
        })
    })

    // Arbitrum is the chain the kill-switch allows, so the scan still goes through.
    it('still goes into the withdrawal under the kill-switch', async () => {
        mockMaintenance.disableXchainWithdraw = true

        const { path, destination } = withdrawEntry(await scanAndConfirm(CHECKSUMMED))

        expect(path).toBe('/withdraw')
        expect(destination).toEqual({ address: CHECKSUMMED })
    })
})

describe('a signed-in scan of an ENS name', () => {
    // The withdrawal starts on the wallet chain, and a name can hold a different
    // address per chain (ENSIP-11), so it resolves for that chain.
    it('resolves the name for the wallet chain and carries it beside the address', async () => {
        mockResolveEns.mockResolvedValue(CHECKSUMMED)

        const { path, params, destination } = withdrawEntry(await scanAndConfirm('alice.eth'))

        expect(mockResolveEns).toHaveBeenCalledWith('alice.eth', '42161')
        expect(path).toBe('/withdraw')
        expect(params.toString()).not.toContain('alice.eth')
        expect(destination).toEqual({ address: CHECKSUMMED, name: 'alice.eth' })
    })

    it('a name that resolves to nothing is unrecognized', async () => {
        mockResolveEns.mockResolvedValue(undefined)

        await scanOnly('alice.eth')

        expect(screen.getByText('Unrecognized QR code')).toBeInTheDocument()
    })
})

describe('a signed-in scan of an EIP-681 payment request', () => {
    it('carries the chain and token it names, and a dollar amount', async () => {
        const { path, params, destination } = withdrawEntry(await scanAndConfirm(EIP681_BASE_USDC))

        expect(path).toBe('/withdraw')
        expect(params.get('amount')).toBe('10')
        expect(params.toString().toLowerCase()).not.toContain(LOWERCASE)
        expect(destination).toEqual({
            address: LOWERCASE,
            chainId: '8453',
            tokenSymbol: 'USDC',
            tokenAddress: BASE_USDC,
        })
    })

    // Several contracts can share a symbol. The withdrawal selects one by
    // symbol, so only a request for that contract is paid (Chip, #3796).
    it('carries the exact contract it names when the withdrawal selects that one', async () => {
        const { destination } = withdrawEntry(await scanAndConfirm(eip681Transfer(OPTIMISM_USDC, '10')))

        expect(destination).toEqual(
            expect.objectContaining({ chainId: '10', tokenSymbol: 'USDC', tokenAddress: OPTIMISM_USDC })
        )
    })

    // Today's payment page hid the network selector for a chain in the URL and
    // would have attempted a cross-chain payment the request flow locks out.
    it('is not supported on a chain we do not pay out to', async () => {
        await scanOnly(`ethereum:${CHECKSUMMED}@999999`)

        expect(screen.getByText(/not supported yet/)).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('is not supported on another chain while the kill-switch is on', async () => {
        mockMaintenance.disableXchainWithdraw = true

        await scanOnly(EIP681_BASE_USDC)

        expect(screen.getByText(/not supported yet/)).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })

    it('with no chain, leaves the network to the user like a bare address', async () => {
        const { path, params, destination } = withdrawEntry(await scanAndConfirm(`ethereum:${CHECKSUMMED}`))

        expect(path).toBe('/withdraw')
        expect(params.get('amount')).toBeNull()
        expect(destination).toEqual({ address: LOWERCASE })
        expect(destination?.chainId).toBeUndefined()
    })

    it('with a chain and no asset starts on that chain with its default token', async () => {
        const { params, destination } = withdrawEntry(await scanAndConfirm(`ethereum:${CHECKSUMMED}@8453`))

        expect(params.get('amount')).toBeNull()
        expect(destination).toEqual({ address: LOWERCASE, chainId: '8453' })
    })

    it('for native ETH on a chain that pays it out keeps ETH and leaves the amount to the user', async () => {
        const { params, destination } = withdrawEntry(await scanAndConfirm(`ethereum:${CHECKSUMMED}@8453?value=1e17`))

        expect(params.get('amount')).toBeNull()
        expect(destination).toEqual({
            address: LOWERCASE,
            chainId: '8453',
            tokenSymbol: 'ETH',
            tokenAddress: NATIVE,
        })
    })

    // A request is paid in the asset it asks for or not at all. Falling back to
    // USDC would change the asset behind the user's back (Chip, #3796).
    it.each([
        ['a native value on a chain whose native token is not paid out', `ethereum:${CHECKSUMMED}@137?value=1e18`],
        [
            'an ERC-20 we cannot name',
            `ethereum:0x000000000000000000000000000000000000dead@8453/transfer?address=${CHECKSUMMED}&uint256=1e7`,
        ],
        ['an asset on no chain', `ethereum:${CHECKSUMMED}?value=1e18`],
        [
            'a contract that shares its symbol with the one the withdrawal selects',
            eip681Transfer(OPTIMISM_BRIDGED_USDC, '10'),
        ],
    ])('is not supported for %s, never paid in another asset', async (_case, qr) => {
        await scanOnly(qr)

        expect(screen.getByText('Ethereum payment request not supported yet.')).toBeInTheDocument()
        expect(mockPush).not.toHaveBeenCalled()
    })
})

// The scanner is signed-in only, so a guest reaches these through a shared
// link. They keep the payment page.
describe('a guest scan', () => {
    beforeEach(() => {
        mockUser = null
    })

    it.each([
        ['web', false, `/${LOWERCASE}`],
        ['native', true, `/send?recipient=${LOWERCASE}`],
    ])('of an EVM address keeps the payment page on %s', async (_platform, native, expected) => {
        mockIsCapacitor.mockReturnValue(native)

        expect(await scanAndConfirm(CHECKSUMMED)).toBe(expected)
    })

    it('of an ENS name keeps the payment page', async () => {
        mockResolveEns.mockResolvedValue(CHECKSUMMED)

        expect(await scanAndConfirm('alice.eth')).toBe('/alice.eth')
        expect(mockResolveEns).toHaveBeenCalledWith('alice.eth')
    })

    it('of an EIP-681 request keeps the payment page', async () => {
        expect(await scanAndConfirm(EIP681_BASE_USDC)).toBe(`/${LOWERCASE}@8453/10USDC`)
    })
})
