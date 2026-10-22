/**
 * How a destination picked outside the flow — today a scanned QR code — reaches
 * the withdraw flow (TASK-22251).
 *
 * The address is handed over in process and never in the URL: a query parameter
 * rides into PostHog's automatic pageviews, session replay and Sentry
 * breadcrumbs, and redactQrTelemetry only scrubs the QR-specific parameter
 * names — a payout address there would tie where a person sent their money to
 * an identified user. The URL carries only `scan=<id>`.
 *
 * That id is per scan, not a constant marker: /withdraw keeps its layout
 * mounted, so a second scan from that page navigates without remounting, and a
 * value that never changed left the flow holding the first destination. The
 * hand-off is keyed to its scan and consumed at its one use.
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
const TRON_ADDRESS = 'TJRyWwFs9wTFGZg3JbrVriFbNfCug5tDeC'

describe('withdrawScanEntryUrl', () => {
    it('lands on the amount step of the crypto rail, carrying the scan id', () => {
        const params = new URLSearchParams(withdrawScanEntryUrl('scan-1').split('?')[1])
        expect(Object.fromEntries(params)).toEqual({ step: 'amount', method: 'crypto', [SCAN_ID_PARAM]: 'scan-1' })
    })

    it('carries no address — the whole point of the in-process hand-off', () => {
        const id = stashScannedDestination(SOLANA_ADDRESS, 'solana')!
        expect(withdrawScanEntryUrl(id)).not.toContain(SOLANA_ADDRESS)
    })

    // The amount step takes USD, so only a dollar stablecoin's amount means the
    // same thing there. Any other token's amount would be read as dollars.
    const entryAmount = (tokenSymbol: string | undefined, amount: string) =>
        new URLSearchParams(withdrawScanEntryUrl('scan-1', { tokenSymbol, amount }).split('?')[1]).get('amount')

    it.each([
        ['a USDC request', 'USDC', '10'],
        ['a USDT request, whatever the case', 'usdt', '2.5'],
    ])('carries the amount of %s', (_case, tokenSymbol, amount) => {
        expect(entryAmount(tokenSymbol, amount)).toBe(amount)
    })

    it.each([
        ['an ETH request', 'ETH'],
        ['a request that names no token', undefined],
    ])('leaves out the amount of %s', (_case, tokenSymbol) => {
        expect(entryAmount(tokenSymbol, '0.1')).toBeNull()
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
        expect(takeScannedDestination(id)).toEqual({
            address: SOLANA_ADDRESS,
            chainId: 'solana',
            networkPending: false,
        })
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
        expect(takeScannedDestination(second)).toEqual({
            address: OTHER_SOLANA_ADDRESS,
            chainId: 'solana',
            networkPending: false,
        })
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

    // An ENS name resolves to the address, and the recipient step shows both.
    it('hands over the ENS name the address was resolved from', () => {
        const id = stashScannedDestination(EVM_ADDRESS, undefined, { name: 'alice.eth' })
        expect(takeScannedDestination(id)).toEqual({ address: EVM_ADDRESS, name: 'alice.eth', networkPending: true })
    })

    it('hands over the token a payment request asks for', () => {
        const id = stashScannedDestination(EVM_ADDRESS, '8453', { tokenSymbol: 'USDC' })
        expect(takeScannedDestination(id)).toEqual({
            address: EVM_ADDRESS,
            chainId: '8453',
            tokenSymbol: 'USDC',
            networkPending: false,
        })
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
            networkPending: false,
        })
    })

    it('accepts a base58 address on Tron, which delivers USDT and no USDC', () => {
        expect(readWithdrawDestination(TRON_ADDRESS, 'tron')).toEqual({
            address: TRON_ADDRESS,
            chainId: 'tron',
            networkPending: false,
        })
    })

    it('accepts an EVM address on an EVM chain Rhino delivers to', () => {
        expect(readWithdrawDestination(EVM_ADDRESS, '8453')).toEqual({
            address: EVM_ADDRESS,
            chainId: '8453',
            networkPending: false,
        })
    })

    // One EVM address is valid on every EVM chain, so a bare scan names no
    // network. The user has to pick it, and the checksum case stays intact.
    it('accepts an EVM address with no chain, leaving the network to the user', () => {
        expect(readWithdrawDestination(EVM_ADDRESS)).toEqual({ address: EVM_ADDRESS, networkPending: true })
    })

    it.each([
        ['a Solana address', SOLANA_ADDRESS],
        ['a Tron address', TRON_ADDRESS],
    ])('refuses %s with no chain — only an EVM address can leave the network open', (_case, address) => {
        expect(readWithdrawDestination(address)).toBeNull()
    })

    it.each([
        ['neither param', null, null],
        ['an address of the wrong family for the chain', EVM_ADDRESS, 'solana'],
        ['a base58 address on an EVM chain', SOLANA_ADDRESS, '8453'],
        ['a Solana address on Tron — same alphabet, different family', SOLANA_ADDRESS, 'tron'],
        ['a chain that is not a withdraw destination', SOLANA_ADDRESS, 'bitcoin'],
    ])('rejects %s', (_case, address, chainId) => {
        expect(readWithdrawDestination(address, chainId)).toBeNull()
    })

    it('refuses every destination that names its chain while the ops kill-switch locks withdrawals to Arbitrum', () => {
        mockConfig.disableXchainWithdraw = true
        expect(readWithdrawDestination(SOLANA_ADDRESS, 'solana')).toBeNull()
        expect(readWithdrawDestination(EVM_ADDRESS, '8453')).toBeNull()
    })

    // The lock pins USDC on Arbitrum and disables the network pick, so a pending
    // network could never be confirmed. Arbitrum is the same chain, which the
    // lock allows.
    it('accepts a chainless EVM address under the kill-switch with no network to pick', () => {
        mockConfig.disableXchainWithdraw = true
        expect(readWithdrawDestination(EVM_ADDRESS)).toEqual({ address: EVM_ADDRESS, networkPending: false })
    })
})

// A payment request (EIP-681) is paid in the token it asks for or not at all:
// the token has to be one Rhino delivers to the requested chain.
describe("a payment request's token", () => {
    beforeEach(() => {
        mockConfig.disableXchainWithdraw = false
    })

    it('is kept when the chain pays it out, whatever its case', () => {
        expect(readWithdrawDestination(EVM_ADDRESS, '8453', 'usdc')).toEqual({
            address: EVM_ADDRESS,
            chainId: '8453',
            tokenSymbol: 'usdc',
            networkPending: false,
        })
    })

    it.each([
        ['a token the chain does not pay out', '8453', 'DAI'],
        ['the native token where Rhino does not bridge it', '137', 'ETH'],
        ['a token on no chain, which nothing can check it against', undefined, 'USDC'],
    ])('refuses %s rather than pay in another asset', (_case, chainId, tokenSymbol) => {
        expect(readWithdrawDestination(EVM_ADDRESS, chainId, tokenSymbol)).toBeNull()
        expect(stashScannedDestination(EVM_ADDRESS, chainId, { tokenSymbol })).toBeNull()
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

    it('takes the token a payment request asks for when the chain has it', () => {
        expect(withdrawTokenForChain([usdc, usdt], 'usdt')).toBe(usdt)
    })

    // A request is paid in its asset or not at all, never in another one.
    it('has no token when the chain lacks the one a payment request asks for', () => {
        expect(withdrawTokenForChain([usdt, usdc], 'DAI')).toBeUndefined()
    })

    it.each([
        ['an empty list', []],
        ['a list that has not arrived', undefined],
    ])('has no token for %s', (_case, tokens) => {
        expect(withdrawTokenForChain(tokens)).toBeUndefined()
    })
})
