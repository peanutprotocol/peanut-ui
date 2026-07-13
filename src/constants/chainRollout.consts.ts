import { CHAIN_REGISTRY } from '@/constants/chainRegistry.consts'

/**
 * Per-chain PostHog rollout flags — DERIVED from CHAIN_REGISTRY, keyed by
 * every identifier a chain appears under (selector id, aliases, deposit
 * display name) so one flag governs all surfaces of the same chain.
 *
 * Hygiene: when a chain launch is permanent, delete `rolloutFlag` from its
 * registry entry and the flag in PostHog — flags are scaffolding.
 */
export const CHAIN_ROLLOUT_FLAGS: Record<string, string> = Object.fromEntries(
    CHAIN_REGISTRY.filter((c) => c.rolloutFlag).flatMap((c) =>
        [c.id, ...(c.aliasIds ?? []), ...(c.displayName ? [c.displayName] : [])].map((key) => [key, c.rolloutFlag!])
    )
)
