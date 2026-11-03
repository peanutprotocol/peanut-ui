import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/context/authContext'
import { serverFetch } from '@/utils/api-fetch'
import type { paths } from '@/types/api.generated'
import { useJourneyEpoch } from './journeyEpoch'
import type { AttentionAsk, JourneyState, Tier, Verdict } from './types'
import {
    applyCatalogue,
    asCatalogue,
    asSettings,
    CATALOGUE_VERSION,
    getSettings,
    type CatalogueEntry,
    type AttentionSettings,
} from './catalogue'

type ServerAttentionBody = paths['/users/me/attention']['get']['responses'][200]['content']['application/json']

/**
 * `GET /users/me/attention`: the API's ranking is the authority; the registry's literals are the fallback.
 * `verdicts` has only the asks whose facts the server holds; absent means the client decides.
 */
export type ServerAttention = Omit<
    ServerAttentionBody,
    'ranking' | 'verdicts' | 'catalogueVersion' | 'catalogue' | 'settings' | 'facts' | 'explanations'
> & {
    ranking: (ServerAttentionBody['ranking'][number] & { tier: Tier })[]
    verdicts: Partial<Record<string, Verdict>>
    catalogueVersion?: number
    catalogue?: CatalogueEntry[]
    settings?: AttentionSettings
    facts?: {
        onboarding: JourneyState['onboarding']
        firstPeerPaymentAt: string | null
        lastSpendAt: string | null
        spendHistoryAvailable: boolean
        hasMadeQrPayment: boolean | null
        hasReceivedRequestPayment: boolean | null
    }
    explanations?: Record<string, { verdict: Verdict; reason: string; unknownSources: string[] }>
}

const TIERS: readonly unknown[] = [1, 2, 3, 4, 5, 6]
const VERDICTS: readonly unknown[] = ['show', 'pending', 'done', 'ineligible', 'unknown']

/** anything but a version-1 body (a demo or fixture default, a proxy page) reads as no answer */
export function asServerAttention(body: unknown): ServerAttention | undefined {
    if (!body || typeof body !== 'object') return undefined
    const { version, ranking, verdicts } = body as Partial<ServerAttention>
    if (
        version !== 1 ||
        !Array.isArray(ranking) ||
        ranking.length > 64 ||
        !verdicts ||
        typeof verdicts !== 'object' ||
        Array.isArray(verdicts)
    )
        return undefined
    const raw = body as Record<string, unknown>
    const catalogue = raw.catalogueVersion === CATALOGUE_VERSION ? asCatalogue(raw.catalogue) : undefined
    const settings = catalogue ? asSettings(raw.settings) : undefined
    const incompatiblePolicy = raw.catalogueVersion !== undefined && (!catalogue || !settings)
    const facts = asFacts(raw.facts)
    const explanations = asExplanations(raw.explanations)
    // a malformed row drops alone; a tier outside 1–6 has no interrupt budget, so it would interrupt
    return {
        version: 1,
        nextAsk: !incompatiblePolicy && typeof raw.nextAsk === 'string' ? raw.nextAsk : null,
        ranking: (incompatiblePolicy ? [] : ranking).filter(
            (entry) =>
                !!entry && typeof entry.id === 'string' && TIERS.includes(entry.tier) && Number.isFinite(entry.rank)
        ),
        verdicts: incompatiblePolicy
            ? {}
            : Object.fromEntries(Object.entries(verdicts).filter(([, verdict]) => VERDICTS.includes(verdict))),
        ...(catalogue && settings ? { catalogueVersion: CATALOGUE_VERSION, catalogue, settings } : {}),
        ...(facts ? { facts } : {}),
        ...(!incompatiblePolicy && explanations ? { explanations } : {}),
    }
}

const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value)
const dateOrNull = (value: unknown): value is string | null =>
    value === null || (typeof value === 'string' && Number.isFinite(Date.parse(value)))

function asFacts(value: unknown): ServerAttention['facts'] {
    if (
        !object(value) ||
        !dateOrNull(value.firstPeerPaymentAt) ||
        !dateOrNull(value.lastSpendAt) ||
        typeof value.spendHistoryAvailable !== 'boolean' ||
        (value.hasMadeQrPayment !== null && typeof value.hasMadeQrPayment !== 'boolean') ||
        (value.hasReceivedRequestPayment !== null && typeof value.hasReceivedRequestPayment !== 'boolean')
    )
        return undefined
    let onboarding: JourneyState['onboarding'] = null
    const candidate = value.onboarding
    if (
        object(candidate) &&
        ['done', 'in_review', 'action_required', 'failed', 'todo'].includes(String(candidate.verify)) &&
        typeof candidate.addMoneyDone === 'boolean' &&
        typeof candidate.firstPaymentDone === 'boolean' &&
        ['card_qr', 'card', 'qr', 'none', 'pending'].includes(String(candidate.firstPaymentRoute)) &&
        ['verify', 'add_money', 'first_payment', 'completed'].includes(String(candidate.step))
    ) {
        onboarding = {
            verify: candidate.verify,
            addMoneyDone: candidate.addMoneyDone,
            firstPaymentDone: candidate.firstPaymentDone,
            firstPaymentRoute: candidate.firstPaymentRoute,
            step: candidate.step,
            ...(typeof candidate.cardHeld === 'boolean' ? { cardHeld: candidate.cardHeld } : {}),
        } as JourneyState['onboarding']
    }
    return {
        onboarding,
        firstPeerPaymentAt: value.firstPeerPaymentAt,
        lastSpendAt: value.lastSpendAt,
        spendHistoryAvailable: value.spendHistoryAvailable,
        hasMadeQrPayment: value.hasMadeQrPayment as boolean | null,
        hasReceivedRequestPayment: value.hasReceivedRequestPayment as boolean | null,
    }
}

function asExplanations(value: unknown): ServerAttention['explanations'] {
    if (!object(value) || Object.keys(value).length > 64) return undefined
    const rows: NonNullable<ServerAttention['explanations']> = {}
    const boundedReason = (reason: unknown): reason is string =>
        typeof reason === 'string' && /^[a-z0-9_. -]{1,100}$/i.test(reason)
    for (const [id, entry] of Object.entries(value)) {
        if (
            !/^[a-z0-9-]{1,40}$/.test(id) ||
            !object(entry) ||
            !VERDICTS.includes(entry.verdict) ||
            !boundedReason(entry.reason) ||
            !Array.isArray(entry.unknownSources) ||
            entry.unknownSources.length > 16 ||
            !entry.unknownSources.every(boundedReason)
        )
            continue
        rows[id] = { verdict: entry.verdict as Verdict, reason: entry.reason, unknownSources: entry.unknownSources }
    }
    return rows
}

export function applyServerFacts(state: JourneyState, server: ServerAttention | undefined): JourneyState {
    const facts = server?.facts
    return {
        ...state,
        attentionSettings: getSettings(server),
        spendHistoryAvailable: facts?.spendHistoryAvailable ?? false,
        ...(facts
            ? {
                  onboarding: facts.onboarding ?? state.onboarding,
                  firstPeerPaymentAt: facts.firstPeerPaymentAt,
                  lastSpendAt: facts.spendHistoryAvailable ? facts.lastSpendAt : null,
                  hasReceivedRequestPayment: facts.hasReceivedRequestPayment ?? undefined,
                  qr: { ...state.qr, hasMadeQrPayment: facts.hasMadeQrPayment ?? undefined },
              }
            : {}),
    }
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
    const catalogue = new Map(
        (server.catalogueVersion === CATALOGUE_VERSION ? (server.catalogue ?? []) : []).map((entry) => [
            entry.id,
            entry,
        ])
    )
    return asks.map((ask) => {
        const rule = catalogue.get(ask.id)
        const configured = rule ? applyCatalogue(ask, rule) : ask
        const ranked = ranking.get(ask.id)
        const verdict = server.verdicts[ask.id]
        if (!ranked && !verdict) return configured
        return {
            ...configured,
            ...(server.catalogueVersion !== CATALOGUE_VERSION && ranked
                ? { tier: ranked.tier, rank: ranked.rank }
                : {}),
            ...(verdict
                ? {
                      eligible: (state: JourneyState): Verdict => {
                          const device = ask.deviceGate?.(state)
                          if (device && device !== 'ready') return device
                          // The server cannot always know a client-only activation path.
                          if (ask.id === 'checklist' && verdict === 'unknown') return ask.eligible(state)
                          if (verdict !== 'show' || ask.renderable?.(state) !== false) return verdict
                          // the app's own input is still loading: hold lower asks as the local verdict would
                          return ask.eligible(state) === 'unknown' ? 'unknown' : 'pending'
                      },
                  }
                : {}),
        }
    })
}
