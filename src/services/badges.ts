import type { paths } from '@/types/api.generated'
import { apiFetch } from '@/utils/api-fetch'
import { apiErrorFromResponse } from './api-error'

type BadgeCatalogResponse = paths['/badge/catalog']['get']['responses'][200]['content']['application/json']

export type BadgeCatalogEntry = BadgeCatalogResponse['badges'][number]
export type BadgeUnlockRequirement = BadgeCatalogEntry['unlock']

// the caller's query key carries the locale, so ask for that language
// explicitly: before the startup locale applies, callApi sends no
// accept-language and the api would answer in the stored locale
export async function getBadgeCatalog(locale: string): Promise<BadgeCatalogEntry[]> {
    const response = await apiFetch('/badge/catalog', { method: 'GET', headers: { 'Accept-Language': locale } })
    if (!response.ok) throw await apiErrorFromResponse(response, 'Failed to load badge catalog')
    const body = (await response.json()) as BadgeCatalogResponse
    return body.badges
}
