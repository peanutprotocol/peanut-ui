// The contract's pattern for a variant id and an experiment id.
const ID = /^[a-z0-9][a-z0-9-]{0,31}$/
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export type VariantCookie = { experimentId: string; variantId: string }

export function variantCookieName(username: string): string {
    return `cpv_${username}`
}

/** Value format: `<experimentId>.<variantId>`. */
export function parseVariantCookie(value: string | null | undefined): VariantCookie | null {
    const [experimentId, variantId, ...rest] = (value ?? '').split('.')
    if (rest.length || !ID.test(experimentId) || !ID.test(variantId ?? '')) return null
    return { experimentId, variantId }
}

/** A `document.cookie` assignment. `Path=/go` keeps the cookie off every other request. */
export function serializeVariantCookie(username: string, { experimentId, variantId }: VariantCookie): string {
    return `${variantCookieName(username)}=${experimentId}.${variantId}; Max-Age=${MAX_AGE_SECONDS}; Path=/go; SameSite=Lax; Secure`
}
