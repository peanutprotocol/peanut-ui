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

/**
 * What PUT /users/kyc-intents did for one feature, for a user whose one-shot
 * identity check is approved (item 4c): the API re-runs the plan on the
 * verified facts and the new ticks, with no new check.
 * - `on`: the provider already held the user
 * - `setting_up`: the rails are enrolled and the submission sent or queued
 * - `action_required`: the card still needs its questions and agreements
 * - `refused`: the plan refuses the provider; `reason` is a GET /config/kyc-intents code
 * - `not_requested`: the feature is not ticked
 * - `pending`: the facts could not be read; the tick is saved, nothing enabled yet
 */
export type FeatureSetupState = 'on' | 'setting_up' | 'action_required' | 'refused' | 'not_requested' | 'pending'

export interface FeatureSetup {
    state: FeatureSetupState
    reason?: string
}

export type FeatureSetupReport = Record<KycIntentKey, FeatureSetup>

export interface KycIntentsSaved {
    intents: KycIntentSet
    setAt: string
    /** Absent when nothing ran: the app then reads the rails from /users/me. */
    features?: FeatureSetupReport
}

export const kycIntentsApi = {
    getConfig: async (residence: string, idCountry?: string): Promise<KycIntentsConfig> => {
        const params = new URLSearchParams({ residence })
        if (idCountry) params.set('idCountry', idCountry)
        // Public config: no auth, so it must not queue behind token hydration.
        // The URL names the issuing country of a foreign ID, which stays out of
        // telemetry: a failed request would otherwise report the raw URL to
        // Sentry and its PostHog mirror.
        const response = await apiFetch(`/config/kyc-intents?${params.toString()}`, {
            includeAuth: false,
            redactTelemetry: true,
        })
        if (!response.ok) throw new Error(`Failed to load kyc intents: ${response.status}`)
        return (await response.json()) as KycIntentsConfig
    },

    /**
     * Stores the ticked set. Before the check, only these features are set up
     * after it; after an approved one-shot check, the answer's `features` says
     * what the new ticks got.
     */
    set: async (intents: KycIntentSet): Promise<KycIntentsSaved> => {
        const response = await serverFetch('/users/kyc-intents', {
            method: 'PUT',
            body: JSON.stringify(intents),
        })
        if (!response.ok) throw new Error(`Failed to save kyc intents: ${response.status}`)
        return (await response.json()) as KycIntentsSaved
    },
}
