import { useEffect, useSyncExternalStore } from 'react'
import { isChainRegistryLoaded, loadChainRegistry, subscribeChainRegistry } from '@/utils/chain-registry'

/**
 * Loads viem's chain registry when a screen that names arbitrary chains
 * mounts (and `needed` is true), and re-renders it once the registry is there.
 * Returns whether it has loaded; `getChainName` reads it synchronously after
 * that.
 */
export function useChainRegistry(needed = true): boolean {
    const loaded = useSyncExternalStore(subscribeChainRegistry, isChainRegistryLoaded, () => false)
    useEffect(() => {
        if (needed && !loaded) loadChainRegistry().catch(() => undefined)
    }, [needed, loaded])
    return loaded
}
