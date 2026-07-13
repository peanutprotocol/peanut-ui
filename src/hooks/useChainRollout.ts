'use client'
import { useMemo } from 'react'
import { useFeatureFlags } from '@/hooks/useFeatureFlag'
import { CHAIN_ROLLOUT_FLAGS } from '@/constants/chainRollout.consts'

/**
 * Reactive per-chain rollout gate — thin domain wrapper over
 * `useFeatureFlags` (see `chainRollout.consts.ts` for the chain→flag map and
 * `featureFlag.utils.ts` for the doctrine). Returns a fresh checker identity
 * when PostHog's flags load so memoized chain lists recompute.
 */
export function useChainRollout(): (chainKey: string) => boolean {
    const isFlagEnabled = useFeatureFlags()
    return useMemo(
        () => (chainKey: string) => {
            const flag = CHAIN_ROLLOUT_FLAGS[chainKey]
            if (!flag) return true
            return isFlagEnabled(flag, { nonProdBypass: true })
        },
        [isFlagEnabled]
    )
}
