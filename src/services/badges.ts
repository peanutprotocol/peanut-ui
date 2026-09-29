import type { paths } from '@/types/api.generated'
import { apiFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from './api-error'

type BadgeCatalogResponse = paths['/badge/catalog']['get']['responses'][200]['content']['application/json']

export type BadgeCatalogEntry = BadgeCatalogResponse['badges'][number]
export type BadgeUnlockRequirement = BadgeCatalogEntry['unlock']

export async function getBadgeCatalog(): Promise<BadgeCatalogEntry[]> {
    const response = await apiFetch('/badge/catalog', { method: 'GET' })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to load badge catalog')
    const body = (await response.json()) as BadgeCatalogResponse
    return body.badges
}
