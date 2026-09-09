/** Public card eligibility, with identity and provider checks applied during onboarding. */
import { PEANUT_API_KEY } from '@/constants/general.consts'
import { apiFetch } from '@/utils/api-fetch'

export interface CardInfoResponse {
    isEligible: boolean
    /** Known prohibited residence. Unknown country must still reach verification. */
    geoProhibited?: boolean
    eligibilityReason?: string
}

const cardHeaders = { 'api-key': PEANUT_API_KEY }

export const cardApi = {
    getInfo: async (): Promise<CardInfoResponse> => {
        const response = await apiFetch('/card', {
            method: 'GET',
            headers: cardHeaders,
            cache: 'no-store',
        })
        if (!response.ok) {
            const err = await response.json().catch(() => ({}))
            throw new Error(err.message || err.error || 'Failed to get card info')
        }
        return (await response.json()) as CardInfoResponse
    },
}
