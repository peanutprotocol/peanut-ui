/**
 * The /withdraw destination query contract (TASK-22251).
 *
 * `?destination=<address>&chain=<chainId>` is how a destination picked outside
 * the flow — today a scanned QR code — reaches the recipient step. It is a URL,
 * so the user can type anything into it; readWithdrawDestination is the one
 * place that decides whether a pair is payable.
 */
const mockConfig = { disableXchainWithdraw: false }
jest.mock('@/config/underMaintenance.config', () => ({ __esModule: true, default: mockConfig }))

import { readWithdrawDestination, withdrawDestinationUrl, withdrawTokenForChain } from '../destination'

const SOLANA_ADDRESS = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
const EVM_ADDRESS = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'

describe('withdrawDestinationUrl', () => {
    it('lands on the amount step of the crypto rail, carrying the destination', () => {
        const params = new URLSearchParams(withdrawDestinationUrl(SOLANA_ADDRESS, 'solana').split('?')[1])
        expect(Object.fromEntries(params)).toEqual({
            step: 'amount',
            method: 'crypto',
            destination: SOLANA_ADDRESS,
            chain: 'solana',
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
