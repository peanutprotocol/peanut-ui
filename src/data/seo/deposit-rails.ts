// Crypto networks + fiat rails served at /deposit/via-{slug}. Hardcoded because
// rails have no entity data — they're purely a content-page concept.
//
// Single source of truth, deliberately dependency-free so it can be imported by
// both the route data layer (exchanges.ts) AND the content link validator
// (scripts/verify-content.ts) without dragging in content-reading side effects.
// Both classify a deposit slug the same way the live route does: in this set →
// `via-{slug}`, otherwise it's an exchange → `from-{slug}`.
export const DEPOSIT_RAILS: Record<string, string> = {
    ach: 'ACH Bank Transfer',
    sepa: 'SEPA Bank Transfer',
    wire: 'Wire Transfer',
    arbitrum: 'Arbitrum',
    avalanche: 'Avalanche',
    base: 'Base',
    ethereum: 'Ethereum',
    polygon: 'Polygon',
    solana: 'Solana',
    tron: 'Tron',
}
