'use client'
import { useEffect, useReducer } from 'react'
import posthog from 'posthog-js'
import { BASE_URL } from '@/constants/general.consts'

/**
 * Per-chain rollout toggles for the Rhino chain expansion — one PostHog
 * feature flag per chain so marketing can enable chains one by one with a
 * click (no deploy). Keyed by every identifier a chain appears under in the
 * selector/deposit surfaces (EVM numeric chainId, non-EVM slug, deposit
 * ChainName) so one flag governs all surfaces of the same chain.
 *
 * Semantics:
 * - chains NOT in this map (the legacy set) are always on
 * - outside the prod domain (staging/preview/local) everything is ON — QA
 *   must be able to test a chain before its public launch
 * - on prod, a chain shows only when its flag is enabled; if PostHog is
 *   unavailable (adblock, outage) new chains stay hidden (fail-closed —
 *   a rollout gate must never fail into "launched")
 */
export const CHAIN_ROLLOUT_FLAGS: Record<string, string> = {
    // withdraw destinations (EVM chainId keys)
    '43114': 'chain-rollout-avalanche',
    '999': 'chain-rollout-hyperevm',
    '57073': 'chain-rollout-ink',
    '747474': 'chain-rollout-katana',
    '59144': 'chain-rollout-linea',
    '5000': 'chain-rollout-mantle',
    '9745': 'chain-rollout-plasma',
    '988': 'chain-rollout-stable',
    '4217': 'chain-rollout-tempo',
    // withdraw destinations (non-EVM slugs)
    solana: 'chain-rollout-solana',
    tron: 'chain-rollout-tron',
    // deposit chains (ChainName keys — same flag as the withdraw side where
    // the chain supports both, so one toggle launches the whole chain)
    TEMPO: 'chain-rollout-tempo',
    KAIA: 'chain-rollout-kaia',
    PLASMA: 'chain-rollout-plasma',
}

const IS_PROD_DOMAIN = BASE_URL === 'https://peanut.me'

export function isChainRolledOut(chainKey: string): boolean {
    const flag = CHAIN_ROLLOUT_FLAGS[chainKey]
    if (!flag) return true
    if (!IS_PROD_DOMAIN) return true
    return posthog.isFeatureEnabled(flag) ?? false
}

/**
 * Reactive variant: re-renders once PostHog's flags load (they arrive async
 * after page load), so gated chains pop in rather than requiring a refresh.
 */
export function useChainRollout(): (chainKey: string) => boolean {
    const [, bump] = useReducer((n: number) => n + 1, 0)
    useEffect(() => {
        // returns an unsubscribe function
        return posthog.onFeatureFlags(() => bump())
    }, [])
    return isChainRolledOut
}
