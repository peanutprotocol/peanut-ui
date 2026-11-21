import { API_ERROR_CODES } from '@/services/api-error'

/**
 * Set once the API answers 426 CLIENT_UPDATE_REQUIRED: this app is older than the oldest version
 * the API serves (peanut-api-ts src/wire/client-floor.ts). ClientProviders then shows only the
 * update screen. `store` means the native binary is too old; `reload` means the JS bundle is.
 */
export type UpdateRequired = { update: 'store' | 'reload' }

let current: UpdateRequired | null = null
const listeners = new Set<() => void>()

export function subscribeUpdateRequired(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function getUpdateRequired(): UpdateRequired | null {
    return current
}

/** Reads a 426 off a clone, so the caller still gets the response body. */
export async function noteUpdateRequired(response: Response | undefined): Promise<void> {
    if (response?.status !== 426 || current) return
    let body: unknown
    try {
        body = await response.clone().json()
    } catch {
        return
    }
    if ((body as { code?: unknown } | null)?.code !== API_ERROR_CODES.CLIENT_UPDATE_REQUIRED) return
    current = { update: (body as { update?: unknown }).update === 'store' ? 'store' : 'reload' }
    for (const listener of listeners) listener()
}
