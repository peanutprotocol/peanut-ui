import { apiErrorFromResponse } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import type { paths } from '@/types/api.generated'

type ArrivalResponse = paths['/users/me/arrival']['post']['responses'][200]['content']['application/json']
export type ArrivalPrompt = NonNullable<ArrivalResponse['prompt']>

/**
 * Reports the country the app opened in (TASK-23251). The backend records the
 * visit and answers which arrival prompt to show, or null; it answers a
 * prompt once, so the caller shows whatever comes back.
 */
export async function reportArrival(country: string): Promise<ArrivalPrompt | null> {
    const response = await apiFetch('/users/me/arrival', { method: 'POST', body: JSON.stringify({ country }) })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Could not report the arrival country')
    return ((await response.json()) as ArrivalResponse).prompt
}
