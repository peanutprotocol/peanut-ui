'use client'

import { apiErrorFromResponse } from '@/services/api-error'
import { apiFetch } from '@/utils/api-fetch'
import type { paths } from '@/types/api.generated'

/**
 * The Smart Paperwork Engine's answer for this user (api#1931): which products
 * the residence leaves open, and what each provider needs. It names products
 * only for the features the user picked, so a product it does not list is
 * unknown, never refused.
 */
export type KycPaperwork = paths['/users/kyc/paperwork']['get']['responses'][200]['content']['application/json']
export type PaperworkProduct = KycPaperwork['products'][number]['product']

export async function fetchKycPaperwork(): Promise<KycPaperwork> {
    const response = await apiFetch('/users/kyc/paperwork', { method: 'GET' })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Could not load paperwork')
    return (await response.json()) as KycPaperwork
}
