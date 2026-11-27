import { isCreatorPageLabel } from './label'

const MAX_AGE_SECONDS = 30 * 24 * 60 * 60
const COOKIE_SCOPE = 'Path=/c; SameSite=Lax; Secure'

export type VariantCookie = { experimentId: string; variantId: string }

export function variantCookieName(username: string): string {
    return `cpv_${username}`
}

/** Value format: `<experimentId>.<variantId>`. */
export function parseVariantCookie(value: string | null | undefined): VariantCookie | null {
    const [experimentId, variantId, ...rest] = (value ?? '').split('.')
    if (rest.length || !isCreatorPageLabel(experimentId) || !isCreatorPageLabel(variantId)) return null
    return { experimentId, variantId }
}

/** A `document.cookie` assignment. `Path=/c` keeps the cookie off every other request. */
export function serializeVariantCookie(username: string, { experimentId, variantId }: VariantCookie): string {
    return `${variantCookieName(username)}=${experimentId}.${variantId}; Max-Age=${MAX_AGE_SECONDS}; ${COOKIE_SCOPE}`
}

/** A `document.cookie` assignment that removes the cookie. A browser removes it only under the scope it was written with. */
export function expireVariantCookie(username: string): string {
    return `${variantCookieName(username)}=; Max-Age=0; ${COOKIE_SCOPE}`
}
