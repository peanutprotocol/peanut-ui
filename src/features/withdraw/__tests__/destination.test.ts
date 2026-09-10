/**
 * How a destination picked outside the flow — today a scanned QR code — reaches
 * the withdraw flow (TASK-22251).
 *
 * The address is handed over in process and never in the URL: a query parameter
 * rides into PostHog's automatic pageviews, session replay and Sentry
 * breadcrumbs, and redactQrTelemetry only scrubs the QR-specific parameter
 * names — a payout address there would tie where a person sent their money to
 * an identified user. The URL carries only the `from=scan` marker.
 */
const mockConfig = { disableXchainWithdraw: false }
jest.mock('@/config/underMaintenance.config', () => ({ __esModule: true, default: mockConfig }))

import {
    readScannedDestination,
    readWithdrawDestination,
    stashScannedDestination,
    WITHDRAW_SCAN_ENTRY_URL,
    withdrawTokenForChain,
} from '../destination'

const SOLANA_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const EVM_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

describe('WITHDRAW_SCAN_ENTRY_URL', () => {
    it('lands on the amount step of the crypto rail and says a scan sent you', () => {
        const params = new URLSearchParams(WITHDRAW_SCAN_ENTRY_URL.split('?')[1])
        expect(Object.fromEntries(params)).toEqual({ step: 'amount', method: 'crypto', from: 'scan' })
    })

    it('carries no address — the whole point of the in-process hand-off', () => {
        stashScannedDestination(SOLANA_ADDRESS, 'solana')
        expect(WITHDRAW_SCAN_ENTRY_URL).not.toContain(SOLANA_ADDRESS)
    })
})

describe('the scanned-destination hand-off', () => {
    beforeEach(() => {
        mockConfig.disableXchainWithdraw = false
    })

    it('accepts a payable destination and hands it on', () => {
        expect(stashScannedDestination(SOLANA_ADDRESS, 'solana')).toBe(true)
        expect(readScannedDestination()).toEqual({ address: SOLANA_ADDRESS, chainId: 'solana' })
    })

    it('reads the same destination twice — a one-shot read would lose it to a re-invoked initializer', () => {
        stashScannedDestination(SOLANA_ADDRESS, 'solana')
        expect(readScannedDestination()).toEqual(readScannedDestination())
    })

    it('stores nothing it cannot pay out to, and keeps what it had', () => {
        stashScannedDestination(SOLANA_ADDRESS, 'solana')
        expect(stashScannedDestination(EVM_ADDRESS, 'solana')).toBe(false)
        expect(readScannedDestination()?.address).toBe(SOLANA_ADDRESS)
    })
})

describe('readWithdrawDestination', () => {
    beforeEach(() => {
        mockConfig.disableXchainWithdraw = false
    })

    it('accepts a base58 address on Solana, case intact', () => {
        expect(readWithdrawDestination(SOLANA_ADDRESS, 'solana')).toEqual({
            address: SOLANA_ADDRESS,
            chainId: 'solana',
        })
    })

    it('accepts an EVM address on an EVM chain Rhino delivers to', () => {
        expect(readWithdrawDestination(EVM_ADDRESS, '8453')).toEqual({ address: EVM_ADDRESS, chainId: '8453' })
    })

    it.each([
        ['neither param', null, null],
        ['an address of the wrong family for the chain', EVM_ADDRESS, 'solana'],
        ['a base58 address on an EVM chain', SOLANA_ADDRESS, '8453'],
        ['a chain that is not a withdraw destination', SOLANA_ADDRESS, 'bitcoin'],
    ])('rejects %s', (_case, address, chainId) => {
        expect(readWithdrawDestination(address, chainId)).toBeNull()
    })

    it('refuses everything while the ops kill-switch locks withdrawals to Arbitrum', () => {
        mockConfig.disableXchainWithdraw = true
        expect(readWithdrawDestination(SOLANA_ADDRESS, 'solana')).toBeNull()
    })
})

describe('withdrawTokenForChain', () => {
    const usdc = { symbol: 'USDC', address: 'usdc' } as never
    const usdt = { symbol: 'USDT', address: 'usdt' } as never

    it('prefers USDC', () => {
        expect(withdrawTokenForChain([usdt, usdc])).toBe(usdc)
    })

    it("falls back to the chain's only token (Tron delivers USDT and no USDC)", () => {
        expect(withdrawTokenForChain([usdt])).toBe(usdt)
    })

    it.each([
        ['an empty list', []],
        ['a list that has not arrived', undefined],
    ])('has no token for %s', (_case, tokens) => {
        expect(withdrawTokenForChain(tokens)).toBeUndefined()
    })
})
