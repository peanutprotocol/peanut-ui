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
    clearScannedDestination,
    readWithdrawDestination,
    SCAN_ID_PARAM,
    stashScannedDestination,
    takeScannedDestination,
    withdrawScanEntryUrl,
    withdrawTokenForChain,
} from '../destination'

const SOLANA_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const EVM_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'
const OTHER_SOLANA_ADDRESS = 'DRpbCBMxVnDK7maPM5tGv6MvB3v1sRMC86PZ8okm21hy'

describe('withdrawScanEntryUrl', () => {
    it('lands on the amount step of the crypto rail, carrying the scan id', () => {
        const params = new URLSearchParams(withdrawScanEntryUrl('scan-1').split('?')[1])
        expect(Object.fromEntries(params)).toEqual({ step: 'amount', method: 'crypto', [SCAN_ID_PARAM]: 'scan-1' })
    })

    it('carries no address — the whole point of the in-process hand-off', () => {
        const id = stashScannedDestination(SOLANA_ADDRESS, 'solana')!
        expect(withdrawScanEntryUrl(id)).not.toContain(SOLANA_ADDRESS)
    })
})

describe('the scanned-destination hand-off', () => {
    beforeEach(() => {
        mockConfig.disableXchainWithdraw = false
        clearScannedDestination()
    })

    it('hands a payable destination to the scan that stashed it', () => {
        const id = stashScannedDestination(SOLANA_ADDRESS, 'solana')
        expect(id).toBeTruthy()
        expect(takeScannedDestination(id)).toEqual({ address: SOLANA_ADDRESS, chainId: 'solana' })
    })

    it('hands it over once — pressing on again cannot re-apply it', () => {
        const id = stashScannedDestination(SOLANA_ADDRESS, 'solana')
        takeScannedDestination(id)
        expect(takeScannedDestination(id)).toBeNull()
    })

    // /withdraw keeps its layout mounted, so a second scan navigates without
    // remounting. Each scan gets its own id, and only the current one is served.
    it('serves the newest scan, never the one it replaced', () => {
        const first = stashScannedDestination(SOLANA_ADDRESS, 'solana')
        const second = stashScannedDestination(OTHER_SOLANA_ADDRESS, 'solana')
        expect(first).not.toBe(second)
        expect(takeScannedDestination(first)).toBeNull()
        expect(takeScannedDestination(second)).toEqual({ address: OTHER_SOLANA_ADDRESS, chainId: 'solana' })
    })

    it.each([
        ['no id at all', null],
        ['an id from no scan', 'scan-does-not-exist'],
    ])('hands nothing to %s', (_case, id) => {
        stashScannedDestination(SOLANA_ADDRESS, 'solana')
        expect(takeScannedDestination(id)).toBeNull()
    })

    it('stores nothing it cannot pay out to, and keeps what it had', () => {
        const id = stashScannedDestination(SOLANA_ADDRESS, 'solana')
        expect(stashScannedDestination(EVM_ADDRESS, 'solana')).toBeNull()
        expect(takeScannedDestination(id)?.address).toBe(SOLANA_ADDRESS)
    })

    it('drops a pending hand-off when the user picks a destination by hand', () => {
        const id = stashScannedDestination(SOLANA_ADDRESS, 'solana')
        clearScannedDestination()
        expect(takeScannedDestination(id)).toBeNull()
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
