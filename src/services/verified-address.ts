import { apiFetch } from '@/utils/api-fetch'

/**
 * The logged-in user's own verified postal address, as `GET
 * /users/me/verified-address` returns it. Country is ISO 3166-1 alpha-2.
 *
 * Written out here rather than taken from `@/types/api.generated`: the
 * regenerated snapshot could not be committed on this branch (see the commit
 * body). Swapping this for the generated type is a one-line follow-up once it
 * lands, and `isUsable` below checks the shape at runtime either way.
 */
export interface VerifiedAddress {
    streetLine1: string
    city: string
    postalCode: string
    subdivisionCode: string | null
    countryCode: string | null
}

function isUsable(body: unknown): body is VerifiedAddress {
    if (!body || typeof body !== 'object') return false
    const value = body as Record<string, unknown>
    // The three the form needs. A partial address prefills nothing, because
    // half a filled form is worse than an empty one.
    return (
        typeof value.streetLine1 === 'string' &&
        !!value.streetLine1 &&
        typeof value.city === 'string' &&
        !!value.city &&
        typeof value.postalCode === 'string' &&
        !!value.postalCode
    )
}

export const verifiedAddressApi = {
    /**
     * The address, or null when there is nothing to prefill.
     *
     * Null is the answer to every unhappy case the route defines — 204 (no
     * approved identity, no usable address, the provider was slow), 401, 429,
     * and a 404 from a deployment that does not have the route yet. None of
     * them is a failure the user should be told about: the form simply asks,
     * which is what it did before this existed. Only a network fault throws,
     * and the caller treats that the same way.
     */
    get: async (signal?: AbortSignal): Promise<VerifiedAddress | null> => {
        const response = await apiFetch('/users/me/verified-address', { method: 'GET', signal })
        if (response.status === 204 || !response.ok) return null
        const body = (await response.json()) as unknown
        if (!isUsable(body)) return null
        const { streetLine1, city, postalCode, subdivisionCode, countryCode } = body
        return {
            streetLine1,
            city,
            postalCode,
            subdivisionCode: typeof subdivisionCode === 'string' && subdivisionCode ? subdivisionCode : null,
            countryCode: typeof countryCode === 'string' && countryCode ? countryCode.toUpperCase() : null,
        }
    },
}
