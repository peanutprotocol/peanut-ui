import { apiFetch, serverFetch } from '@/utils/api-fetch'

/** The four features one identity check can unlock, in checklist order. */
export const KYC_INTENT_KEYS = ['qr', 'local', 'card', 'bank'] as const
export type KycIntentKey = (typeof KYC_INTENT_KEYS)[number]

export interface KycIntentAvailability {
    available: boolean
    /** Why the feature is closed, as the backend names it: a residence rule or
     *  a document rule (see SHOWN_CLOSED_REASONS in unlock-checklist.utils). */
    reason?: string
}

/** GET /config/kyc-intents: what a residence can unlock with the ID the user will show. */
export interface KycIntentsConfig {
    residence: string
    intents: Record<KycIntentKey, KycIntentAvailability>
}

export type KycIntentSet = Record<KycIntentKey, boolean>

export const kycIntentsApi = {
    getConfig: async (residence: string, idCountry?: string): Promise<KycIntentsConfig> => {
        const params = new URLSearchParams({ residence })
        if (idCountry) params.set('idCountry', idCountry)
        // public config: no auth, so it must not queue behind token hydration
        const response = await apiFetch(`/config/kyc-intents?${params.toString()}`, { includeAuth: false })
        if (!response.ok) throw new Error(`Failed to load kyc intents: ${response.status}`)
        return (await response.json()) as KycIntentsConfig
    },

    /** Stores the ticked set. After the check, only these features are set up. */
    set: async (intents: KycIntentSet): Promise<{ intents: KycIntentSet; setAt: string }> => {
        const response = await serverFetch('/users/kyc-intents', {
            method: 'PUT',
            body: JSON.stringify(intents),
        })
        if (!response.ok) throw new Error(`Failed to save kyc intents: ${response.status}`)
        return (await response.json()) as { intents: KycIntentSet; setAt: string }
    },
}
