import { apiFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from '@/services/api-error'

export type CountryWaitlistFlow = 'add' | 'withdraw' | 'send' | 'claim'
export type CountryWaitlistState = { joinedAt: string | null }

export async function countryWaitlist(
    countryCode: string,
    flow: CountryWaitlistFlow,
    method: 'GET' | 'POST'
): Promise<CountryWaitlistState> {
    const response = await apiFetch(`/users/country-waitlist/${encodeURIComponent(countryCode)}/${flow}`, { method })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Could not update the waitlist')
    return response.json()
}
