/**
 * TASK-22590: the static token registry is read before any RPC call, so a
 * wrong `decimals` there becomes the unit of every withdraw request to that
 * token. USDC on BNB Chain is 18-decimal on-chain (`decimals()` = 0x12), not
 * the 6 of USDC elsewhere. These tests run the real registry through both
 * server-side readers and fail if either would fall back to an RPC read.
 */
const mockGetPublicClient = jest.fn(() => {
    throw new Error('registry hit expected — no RPC fallback')
})
jest.mock('@/app/actions/clients', () => ({
    getPublicClient: () => mockGetPublicClient(),
}))
jest.mock('@/services/tokens-price', () => ({ fetchTokenPrice: jest.fn() }))
// jest.setup.ts stubs this module globally; this suite needs the real reader.
jest.unmock('@/app/actions/tokens')

import { fetchTokenDetails } from '@/app/actions/tokens'
import { getSupportedChainsAndTokens } from '@/app/actions/supported-chains'

const BSC = '56'
const BSC_USDC = '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d'
const ARBITRUM = '42161'
const ARBITRUM_USDC = '0xaf88d065e77c8cc2239327c5edb3a432268e5831'

describe('USDC decimals come from the verified on-chain value', () => {
    beforeEach(() => mockGetPublicClient.mockClear())

    it('supported-token metadata reports 18 for USDC on BNB Chain', async () => {
        const chains = await getSupportedChainsAndTokens()
        const usdc = chains[BSC].tokens.find((t) => t.address.toLowerCase() === BSC_USDC)

        expect(usdc).toMatchObject({ symbol: 'USDC', decimals: 18 })
    })

    it('fetchTokenDetails returns 18 for USDC on BNB Chain without an RPC read', async () => {
        // checksummed and lowercase must resolve to the same registry entry
        for (const address of [BSC_USDC, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d']) {
            await expect(fetchTokenDetails(address, BSC)).resolves.toMatchObject({ symbol: 'USDC', decimals: 18 })
        }
        expect(mockGetPublicClient).not.toHaveBeenCalled()
    })

    it('leaves the Arbitrum source USDC at 6', async () => {
        const chains = await getSupportedChainsAndTokens()
        const usdc = chains[ARBITRUM].tokens.find((t) => t.address.toLowerCase() === ARBITRUM_USDC)

        expect(usdc?.decimals).toBe(6)
        await expect(fetchTokenDetails(ARBITRUM_USDC, ARBITRUM)).resolves.toMatchObject({ decimals: 6 })
        expect(mockGetPublicClient).not.toHaveBeenCalled()
    })
})
