/**
 * Per-chain rollout toggles for the Rhino chain expansion — one PostHog
 * feature flag per chain so marketing can launch chains one by one with a
 * click (no deploy). Keyed by every identifier a chain appears under in the
 * selector/deposit surfaces (EVM numeric chainId, non-EVM slug, deposit
 * ChainName) so one flag governs all surfaces of the same chain.
 *
 * Hygiene: once a chain is permanently launched, delete its entry here and
 * its flag in PostHog — flags are scaffolding, not architecture.
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
