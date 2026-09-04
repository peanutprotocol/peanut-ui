/**
 * The middle slot is the card tab OR the exchange-rates tab — never both, and
 * the two are geometrically identical (px-6 around a 20px icon), so the shared
 * pill measures one slot id either way. Which one renders is decided by
 * `useCardSurfaceAccess` in the nav itself.
 */
export type TabId = 'home' | 'middle' | 'support'

export const TAB_ORDER: TabId[] = ['home', 'middle', 'support']
