import * as viemChains from 'viem/chains'
import chainDetails from '@/constants/chain-details.json'
import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'
import { getSupportedViemChain, SUPPORTED_VIEM_CHAINS } from '@/constants/supported-chains.consts'
import { getChainName, isTestnetChain } from '@/utils/general.utils'

// The old lookups scanned viem's whole registry; the first match in namespace
// order is what they returned, so the map must return that same chain.
const registry = Object.values(viemChains) as Array<{ id: number; name: string; testnet?: boolean }>
const fromRegistry = (id: number) => registry.find((chain) => chain?.id === id)

const supportedIds = [
    ...new Set([
        ...Object.keys(chainDetails),
        ...CHAIN_REGISTRY.filter((entry) => entry.family === 'evm').flatMap((entry) => [
            entry.id,
            ...(entry.aliasIds ?? []),
        ]),
        // Not in chain-details: the backend stores Rhino Tron deposits with this
        // sourceChainId, and history passes it to getChainName.
        '728126428',
    ]),
].map(Number)

// In chain-details.json but not in viem: never resolved, before or after.
const NOT_IN_VIEM = [2001]

describe('SUPPORTED_VIEM_CHAINS', () => {
    it.each(supportedIds.filter((id) => !NOT_IN_VIEM.includes(id)))(
        'resolves supported chain %i to the chain the full registry returned',
        (id) => {
            const expected = fromRegistry(id)
            expect(expected).toBeDefined()
            expect(getSupportedViemChain(id)).toBe(expected)
            expect(getSupportedViemChain(String(id))).toBe(expected)
            expect(getChainName(String(id))).toBe(expected!.name)
            expect(isTestnetChain(String(id))).toBe(expected!.testnet === true)
        }
    )

    it('holds no chain outside the supported list', () => {
        expect(SUPPORTED_VIEM_CHAINS.map((chain) => chain.id).sort()).toEqual(
            supportedIds.filter((id) => !NOT_IN_VIEM.includes(id)).sort()
        )
    })

    it.each([...NOT_IN_VIEM, 7777777, 999999999])('returns nothing for unsupported chain %i', (id) => {
        expect(getSupportedViemChain(id)).toBeUndefined()
        expect(getChainName(String(id))).toBeUndefined()
        expect(isTestnetChain(String(id))).toBe(false)
    })

    it('keeps the Solana name for chain id 0', () => {
        expect(getChainName('0')).toBe('Solana')
    })
})
