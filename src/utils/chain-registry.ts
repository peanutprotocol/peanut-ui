import type { Chain } from 'viem'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'

/*
 * viem's chain registry (`viem/chains`, about 700 chains, ~120 KB gzip) loaded
 * on first use instead of statically. A static `import * as chains` put the
 * whole registry in every bundle that reached general.utils or
 * actions/clients, the landing pages included. Code that resolves an arbitrary
 * chain id awaits `loadChainRegistry()`; sync readers use `getLoadedChain()`
 * after an async boundary (history completion, a hook, an event handler) has
 * loaded it. The registry stays the only source of truth: no list of chains is
 * kept here.
 */

type ChainsById = ReadonlyMap<number, Chain>

let chainsById: ChainsById | undefined
let pending: Promise<ChainsById> | undefined
const listeners = new Set<() => void>()

function indexRegistry(registry: Record<string, unknown>): ChainsById {
    const byId = new Map<number, Chain>()
    for (const value of Object.values(registry)) {
        const chain = value as Chain | undefined
        if (!chain || typeof chain !== 'object' || typeof chain.id !== 'number') continue
        // First match wins, like the `find` over `Object.values(chains)` this
        // replaces (several exports can share an id).
        if (!byId.has(chain.id)) byId.set(chain.id, chain)
    }
    return byId
}

/** Loads the registry once; later calls reuse it. A failed load can be retried. */
export function loadChainRegistry(): Promise<ChainsById> {
    if (chainsById) return Promise.resolve(chainsById)
    pending ??= import('viem/chains')
        .then((registry) => {
            chainsById = indexRegistry(registry as unknown as Record<string, unknown>)
            listeners.forEach((notify) => notify())
            return chainsById
        })
        .catch((error: unknown) => {
            pending = undefined
            throw error
        })
    return pending
}

export function isChainRegistryLoaded(): boolean {
    return chainsById !== undefined
}

/** Whether naming this chain needs the registry (the wallet chain does not). */
export function needsChainRegistry(chainId: string | number | undefined): boolean {
    if (chainId === undefined || chainId === null || chainId === '' || chainId === '0') return false
    const id = Number(chainId)
    return Number.isInteger(id) && id !== PEANUT_WALLET_CHAIN.id && !chainsById
}

/**
 * Sync lookup. The wallet chain resolves without the registry; any other id
 * resolves only once the registry is loaded, and asks for the load otherwise
 * so the next read finds it.
 */
export function getLoadedChain(chainId: string | number): Chain | undefined {
    const id = Number(chainId)
    if (!Number.isInteger(id)) return undefined
    if (id === PEANUT_WALLET_CHAIN.id) return PEANUT_WALLET_CHAIN as Chain
    if (!chainsById) {
        void loadChainRegistry().catch(() => undefined)
        return undefined
    }
    return chainsById.get(id)
}

/** Async lookup for code that can wait for the registry. */
export async function getChain(chainId: string | number): Promise<Chain | undefined> {
    const id = Number(chainId)
    if (!Number.isInteger(id)) return undefined
    if (id === PEANUT_WALLET_CHAIN.id) return PEANUT_WALLET_CHAIN as Chain
    return (await loadChainRegistry()).get(id)
}

/** For useSyncExternalStore: re-render once the registry has loaded. */
export function subscribeChainRegistry(notify: () => void): () => void {
    listeners.add(notify)
    return () => {
        listeners.delete(notify)
    }
}
