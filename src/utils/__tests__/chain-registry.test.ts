import type { Chain } from 'viem'
import * as viemChains from 'viem/chains'

type RegistryModule = typeof import('@/utils/chain-registry')

// A fresh module per test: the registry cache is module state.
function freshRegistry(): RegistryModule {
    let mod: RegistryModule | undefined
    jest.isolateModules(() => {
        mod = require('@/utils/chain-registry')
    })
    return mod!
}

// What the replaced code did: first match in viem's export order.
const firstMatch = (id: number) => (Object.values(viemChains) as Chain[]).find((chain) => chain?.id === id)

describe('chain-registry', () => {
    it('names the wallet chain without loading the registry', () => {
        const registry = freshRegistry()
        expect(registry.getLoadedChain(42161)?.name).toBe('Arbitrum One')
        expect(registry.needsChainRegistry('42161')).toBe(false)
        expect(registry.isChainRegistryLoaded()).toBe(false)
    })

    it('needs the registry for other chains until it has loaded', async () => {
        const registry = freshRegistry()
        expect(registry.needsChainRegistry('8453')).toBe(true)
        expect(registry.needsChainRegistry('0')).toBe(false)
        expect(registry.needsChainRegistry(undefined)).toBe(false)
        await registry.loadChainRegistry()
        expect(registry.isChainRegistryLoaded()).toBe(true)
        expect(registry.needsChainRegistry('8453')).toBe(false)
    })

    // isolateModules loads its own copy of viem/chains, so compare by value.
    const summary = (chain: Chain | undefined) => chain && { id: chain.id, name: chain.name, testnet: chain.testnet }

    it('resolves every viem chain id to the chain the first-match scan returned', async () => {
        const registry = freshRegistry()
        await registry.loadChainRegistry()
        const ids = new Set((Object.values(viemChains) as Chain[]).map((chain) => chain.id))
        // Tron (Rhino deposits) and Zora (off-UI request payments) are the ids a curated map missed.
        expect(ids.has(728126428)).toBe(true)
        for (const id of ids) {
            expect(summary(registry.getLoadedChain(id))).toEqual(summary(firstMatch(id)))
            expect(summary(await registry.getChain(String(id)))).toEqual(summary(firstMatch(id)))
        }
        expect(registry.getLoadedChain(728126428)?.name).toBe(firstMatch(728126428)?.name)
        expect(registry.getLoadedChain(7777777)?.name).toBe('Zora')
    })

    it('returns undefined for unknown or malformed ids', async () => {
        const registry = freshRegistry()
        await registry.loadChainRegistry()
        expect(registry.getLoadedChain(987654321987)).toBeUndefined()
        expect(registry.getLoadedChain('not-a-chain')).toBeUndefined()
        expect(await registry.getChain('')).toBeUndefined()
    })

    it('notifies subscribers once when the registry loads', async () => {
        const registry = freshRegistry()
        const notify = jest.fn()
        const unsubscribe = registry.subscribeChainRegistry(notify)
        await Promise.all([registry.loadChainRegistry(), registry.loadChainRegistry()])
        expect(notify).toHaveBeenCalledTimes(1)
        unsubscribe()
    })
})
