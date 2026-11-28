import { apiFetch } from '@/utils/api-fetch'

/**
 * Consent ledger (tos-v1 phase 2). The API is the one source of every legal
 * document version (peanut-api-ts src/consent/consts.ts): signup, card apply
 * and re-consent all record the API's published version, so this client holds
 * no copy of any version (TASK-25073).
 */

export interface ConsentStatusDocument {
    slug: string
    currentVersion: string
    acceptedVersion: string | null
    acceptedAt: string | null
    needsAcceptance: boolean
}

export interface ConsentStatusResponse {
    documents: ConsentStatusDocument[]
    needsReConsent: boolean
}

export const consentApi = {
    getStatus: async (): Promise<ConsentStatusResponse> => {
        const response = await apiFetch('/users/consent/status', { method: 'GET' })
        if (!response.ok) throw new Error(`Failed to load consent status (${response.status})`)
        return await response.json()
    },

    /** Re-consent. `version` is the status endpoint's `currentVersion`; the API
     *  ignores it and records its published one. */
    accept: async (documents: Array<{ slug: string; version: string }>): Promise<{ recorded: number }> => {
        const response = await apiFetch('/users/consent/accept', {
            method: 'POST',
            body: JSON.stringify({ documents }),
        })
        if (!response.ok) throw new Error(`Failed to record acceptance (${response.status})`)
        return await response.json()
    },
}
