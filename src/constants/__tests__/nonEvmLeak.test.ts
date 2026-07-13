/**
 * Leak tripwire for the synthetic non-EVM withdraw records.
 *
 * NON_EVM_WITHDRAW_CHAINS (Solana/Tron) is merged into the GLOBAL
 * tokenSelector context so the withdraw selector and the price hook resolve
 * them. They are kept out of send / claim / pay / URL-parse surfaces only by
 * discipline: those surfaces gate their network list on the wagmi-derived id
 * set (TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS), and URL parsing reads the
 * server action, not the context. This test turns that discipline into an
 * enforced invariant — if a non-EVM chain ever enters a non-withdraw gate,
 * it fails here instead of leaking a broken (base58-address) chain into a
 * send flow.
 */
// TokenSelector.consts imports the wagmi `networks` config, which cannot
// construct under jest — mock it to the real mainnet ids the gate filters on.
jest.mock('@/config', () => ({
    networks: [
        { id: 42161 },
        { id: 1 },
        { id: 10 },
        { id: 137 },
        { id: 100 },
        { id: 8453 },
        { id: 56 },
        { id: 42220 },
        { id: 59144 },
        { id: 534352 },
        { id: 480 }, // worldchain
    ],
}))

import { NON_EVM_WITHDRAW_CHAINS } from '../chainRegistry.consts'
import { TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS } from '@/components/Global/TokenSelector/TokenSelector.consts'
import { supportedPeanutChains } from '@/constants/general.consts'

describe('non-EVM synthetic records do not leak into non-withdraw surfaces', () => {
    const nonEvmIds = Object.keys(NON_EVM_WITHDRAW_CHAINS) // ['solana', 'tron']

    it('has the expected non-EVM ids (guards the test itself)', () => {
        expect(nonEvmIds.sort()).toEqual(['solana', 'tron'])
    })

    it('is disjoint from the non-withdraw network gate (TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS)', () => {
        for (const id of nonEvmIds) {
            expect(TOKEN_SELECTOR_SUPPORTED_NETWORK_IDS).not.toContain(id)
        }
    })

    it('is disjoint from the canonical chain source (supportedPeanutChains — feeds URL parsing/validation)', () => {
        const peanutChainIds = supportedPeanutChains.map((c) => String(c.chainId).toLowerCase())
        for (const id of nonEvmIds) {
            expect(peanutChainIds).not.toContain(id)
        }
    })
})
