import { isGoPageLabel } from '@/features/tracked-links/contract'

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export type VariantCookie = { experimentId: string; variantId: string }

export function variantCookieName(username: string): string {
    return `cpv_${username}`
}

/** Value format: `<experimentId>.<variantId>`. */
export function parseVariantCookie(value: string | null | undefined): VariantCookie | null {
    const [experimentId, variantId, ...rest] = (value ?? '').split('.')
    // The engine's rule for a variant and an experiment id: a cookie it would refuse is not sticky.
    if (rest.length || !isGoPageLabel(experimentId) || !isGoPageLabel(variantId)) return null
    return { experimentId, variantId }
}

/** A `document.cookie` assignment. `Path=/go` keeps the cookie off every other request. */
export function serializeVariantCookie(username: string, { experimentId, variantId }: VariantCookie): string {
    return `${variantCookieName(username)}=${experimentId}.${variantId}; Max-Age=${MAX_AGE_SECONDS}; Path=/go; SameSite=Lax; Secure`
}
