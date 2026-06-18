/**
 * Single source of truth for the deposit *rails* served at /deposit/via-{slug}.
 *
 * Rails are fiat bank rails + crypto networks. They're hardcoded (not entity-
 * backed in mono like exchanges) because a rail is purely a content-page
 * concept. This module is kept **import-free on purpose** so both consumers can
 * pull it without dragging in app code:
 *   - src/data/seo/exchanges.ts → /deposit/[exchange] routes + sitemap
 *   - scripts/verify-content.ts → the standalone content gate
 *
 * Before this existed the list lived in two places ("keep in sync" by hand) and
 * drifted. Add/remove a rail here and nowhere else.
 *
 * Display names come from the values. A slug is a rail iff it's a key here;
 * anything else under content/deposit/ is treated as an exchange (from-{slug}).
 */
export const DEPOSIT_RAILS: Record<string, string> = {
    ach: 'ACH Bank Transfer',
    sepa: 'SEPA Bank Transfer',
    wire: 'Wire Transfer',
    'faster-payments': 'Faster Payments',
    spei: 'SPEI Bank Transfer',
    arbitrum: 'Arbitrum',
    base: 'Base',
    ethereum: 'Ethereum',
    polygon: 'Polygon',
    solana: 'Solana',
    tron: 'Tron',
}

/** Slug set for fast membership checks (route classification + content gate). */
export const RAIL_SLUGS = new Set(Object.keys(DEPOSIT_RAILS))
