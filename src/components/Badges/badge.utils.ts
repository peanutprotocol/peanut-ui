import { PEANUTMAN } from '@/assets/mascot'
import badgeAssets from '@/types/badge-assets.json'

/**
 * Legacy artwork fallback, GENERATED from the backend badge catalog — do not
 * hand-edit. Regenerate with `pnpm badge:check --write-manifest` in
 * peanut-api-ts and copy docs/badge-assets.json here.
 *
 * Badge identity, names, descriptions, visibility, award policy and
 * capabilities all belong to the backend catalog. These paths only keep old
 * catalog responses presentable while `iconUrl` rolls out; they must never be
 * used to infer campaign or access policy.
 */
export const BADGE_ASSET_FALLBACKS: Readonly<Record<string, string>> = badgeAssets.assets

/** Legacy-only iteration for the internal share-asset builder. */
export const BADGE_CODES: readonly string[] = Object.keys(BADGE_ASSET_FALLBACKS)

// Mirror the backend catalog boundary during rolling deploys and for legacy DB
// rows. Badge art is deliberately limited to stable same-origin public assets;
// arbitrary remote, data, traversal, query, and fragment URLs never reach an
// image renderer.
const SAFE_BADGE_ICON_PATH = /^\/badges\/[A-Za-z0-9][A-Za-z0-9._-]*\.(?:svg|png|webp|avif)$/

/** Prefer safe backend presentation; fall back to legacy art, then generic art. */
export function getBadgeIcon(code?: string, iconUrl?: string | null): string {
    const catalogIcon = iconUrl && SAFE_BADGE_ICON_PATH.test(iconUrl) ? iconUrl : null
    return catalogIcon || (code && BADGE_ASSET_FALLBACKS[code]) || PEANUTMAN.src
}

/** Backend names are authoritative; unknown/legacy responses remain readable. */
export function getBadgeDisplayName(code?: string, name?: string | null): string {
    return name?.trim() || code || 'Badge'
}

/** No local copy fallback: descriptions are owned by the backend catalog. */
export function getBadgeDescription(description?: string | null): string | null {
    return description?.trim() || null
}
