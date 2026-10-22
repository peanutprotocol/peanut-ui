'use client'

import { useQuery } from '@tanstack/react-query'
import { AVATAR_ART } from '@/constants/query.consts'
import { apiFetch } from '@/utils/api-fetch'
import type { AvatarArtUrls } from './avatar.utils'

const NO_ART: AvatarArtUrls = {}

/**
 * The API's avatar art map (GET /avatars/art), fetched once per session. Every
 * failure reads as an empty map, so the bundled art renders: an API without
 * the route answers 404, one without an art bucket answers `{}`. Urls are
 * checked where they are used (`servedAvatarArt`), not here.
 */
async function getAvatarArt(): Promise<AvatarArtUrls> {
    try {
        const response = await apiFetch('/avatars/art', {
            method: 'GET',
            includeAuth: false,
            // a 404 from an older API is expected: no Sentry issue for it
            callerReportsFailures: true,
        })
        if (!response.ok) return NO_ART
        const body: unknown = await response.json()
        return body && typeof body === 'object' && !Array.isArray(body) ? (body as AvatarArtUrls) : NO_ART
    } catch {
        return NO_ART
    }
}

export function useAvatarArt(): AvatarArtUrls {
    const { data } = useQuery({
        queryKey: [AVATAR_ART],
        queryFn: getAvatarArt,
        // new art lands with an API deploy; an hour-old map only means bundled art meanwhile
        staleTime: 60 * 60 * 1000,
        gcTime: Infinity,
    })
    return data ?? NO_ART
}
