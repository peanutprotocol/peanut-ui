import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { serverFetch } from '@/utils/api-fetch'
import { useJourneyEpoch } from './journeyEpoch'
import type { AttentionAsk, Tier, Verdict } from './types'

/** `GET /users/me/attention`: the API's ranking is the authority; the registry's literals are the fallback. */
export interface ServerAttention {
    version: number
    ranking: { id: string; tier: Tier; rank: number }[]
    /** only the asks whose facts the server holds; absent means the client decides */
    verdicts: Partial<Record<string, Verdict>>
    nextAsk: string | null
}

/** anything but a version-1 body (a demo or fixture default, a proxy page) reads as no answer */
export function asServerAttention(body: unknown): ServerAttention | undefined {
    if (!body || typeof body !== 'object') return undefined
    const { version, ranking, verdicts } = body as Partial<ServerAttention>
    if (version !== 1 || !Array.isArray(ranking) || !verdicts || typeof verdicts !== 'object') return undefined
    return body as ServerAttention
}

async function fetchServerAttention(): Promise<ServerAttention | undefined> {
    const response = await serverFetch('/users/me/attention', { callerReportsFailures: true })
    // an API deployed before the endpoint: the local ranking decides
    if (response.status === 404) return undefined
    if (!response.ok) throw new Error(`attention ${response.status}`)
    return asServerAttention(await response.json())
}

export function useServerAttention(): ServerAttention | undefined {
    const { user } = useAuth()
    const userId = user?.user.userId ?? null
    const epoch = useJourneyEpoch()
    const query = useQuery({
        queryKey: ['attention', userId],
        queryFn: fetchServerAttention,
        enabled: !!userId,
        staleTime: 30_000,
        retry: 1,
    })

    // a profile update or a ledger write can change a server verdict
    const { refetch } = query
    const seen = useRef<{ user: unknown; epoch: number } | null>(null)
    useEffect(() => {
        if (!userId) return
        const previous = seen.current
        seen.current = { user, epoch }
        if (previous && (previous.user !== user || previous.epoch !== epoch)) void refetch()
    }, [userId, user, epoch, refetch])

    return query.isError ? undefined : query.data
}

export function applyServerRanking(
    asks: readonly AttentionAsk[],
    server: ServerAttention | undefined
): readonly AttentionAsk[] {
    if (!server) return asks
    const ranking = new Map(server.ranking.map((entry) => [entry.id, entry]))
    return asks.map((ask) => {
        const ranked = ranking.get(ask.id)
        const verdict = server.verdicts[ask.id]
        if (!ranked && !verdict) return ask
        return {
            ...ask,
            ...(ranked ? { tier: ranked.tier, rank: ranked.rank } : {}),
            ...(verdict ? { eligible: () => verdict } : {}),
        }
    })
}
