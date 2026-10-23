'use client'

import {
    Component,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ErrorInfo,
    type ReactNode,
} from 'react'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { IS_DEV } from '@/constants/general.consts'
import { getUserPreferences } from '@/utils/general.utils'
import { useAnyOverlayOpen } from '@/utils/overlay-visibility'
import { decide } from './decide'
import { getSessionInterrupts, setSessionInterrupts } from './interruptState'
import { ledgerActions, noteServerLedger, readLedger, subscribeLedger } from './ledger'
import { bumpJourneyEpoch } from './journeyEpoch'
import { useJourneyState } from './journeyState'
import { ASKS } from './registry'
import { applyServerRanking, useServerAttention, type ServerAttention } from './serverAttention'
import { useMountedSlots } from './slotStore'
import type { AskId, AttentionAsk, Decision, JourneyState, Ledger, Session, Surface } from './types'

export { isAttentionInterruptOpen } from './interruptState'

/** how long an `unknown` higher tier may hold lower-tier interrupts (same ceiling as useFlagsSettled) */
export const SETTLE_DEADLINE_MS = 4_000

const DAY_MS = 24 * 60 * 60 * 1000

export type SettleOutcome = 'acted' | 'dismissed' | 'snoozed'

interface AttentionContextValue {
    decision: Decision
    state: JourneyState
    ledger: Ledger
    session: Session
    asks: readonly AttentionAsk[]
    /** a surface for this ask is on screen (AttentionInterrupt reports it; idempotent) */
    opened: (id: AskId) => void
    /** a zone card for this ask is on screen (AttentionZone reports it; once per session per ask) */
    openedZone: (id: AskId) => void
    openedSurface: (id: AskId, surface: Exclude<Surface, 'interrupt'>) => void
    /** the surface threw: settle it as dismissed whether or not it had reported itself open */
    crashed: (id: AskId, surface?: Surface) => void
    /** the user did the thing; completion itself is derived from state */
    acted: (id: AskId, surface?: Surface) => void
    dismissed: (id: AskId, surface?: Surface) => void
    snoozed: (id: AskId, until?: number, surface?: Surface) => void
}

const AttentionContext = createContext<AttentionContextValue | undefined>(undefined)

const EMPTY_LEDGER: Ledger = {}

function useLedger(userId: string | null, server: unknown): Ledger {
    noteServerLedger(server)
    return useSyncExternalStore(
        subscribeLedger,
        () => readLedger(userId, server),
        () => EMPTY_LEDGER
    )
}

export function resetAttentionSessionForTests(): void {
    setSessionInterrupts({ userId: null, ids: [], open: null })
    surfacesShownThisSession = { userId: null, keys: [] }
}

// the zone cards already booked this app load, for which account
let surfacesShownThisSession: { userId: string | null; keys: string[] } = { userId: null, keys: [] }

function useSession(state: JourneyState, openInterrupt: AskId | null): Session {
    const busy = useAnyOverlayOpen()
    const slots = useMountedSlots()
    const [settleDeadlinePassed, setSettleDeadlinePassed] = useState(false)

    useEffect(() => {
        setSettleDeadlinePassed(false)
        if (!state.userId) return undefined
        const timer = setTimeout(() => setSettleDeadlinePassed(true), SETTLE_DEADLINE_MS)
        return () => clearTimeout(timer)
    }, [state.userId])

    const current = getSessionInterrupts()
    return useMemo(
        () => ({
            slots,
            count: getUserPreferences(state.userId ?? undefined)?.sessionCount ?? 0,
            route: state.route,
            interruptsThisSession: current.userId === state.userId ? current.ids : [],
            openInterrupt,
            busy,
            // the mobile layout swaps the whole tree for its gates (offline, backend
            // down, auth), so while this provider is mounted no gate is up
            gateUp: false,
            settleDeadlinePassed,
        }),
        [state.userId, state.route, current, openInterrupt, busy, settleDeadlinePassed, slots]
    )
}

/** One `attention_decided` per distinct decision, so the trace can be read against `modal_shown`. */
function useDecisionReport(
    decision: Decision,
    state: JourneyState,
    session: Session,
    server: ServerAttention | undefined
): void {
    const reported = useRef<string | null>(null)
    useEffect(() => {
        if (!state.userId || !state.userLoaded) return
        const key = `${state.userId}:${decision.interrupt}:${decision.zone?.id ?? null}:${decision.zone?.mode ?? ''}:${decision.zone?.underlay ?? ''}:${decision.inline?.id ?? null}:${decision.inline?.slot ?? null}:${decision.banner}:${decision.suspended}`
        if (reported.current === key) return
        reported.current = key
        const payload = {
            shadow: false,
            interrupt: decision.interrupt,
            zone: decision.zone?.id ?? null,
            zone_mode: decision.zone?.mode ?? null,
            zone_replaced: decision.zone?.underlay ?? null,
            inline: decision.inline?.id ?? null,
            inline_slot: decision.inline?.slot ?? null,
            banner: decision.banner,
            suspended: decision.suspended,
            overlay_open: session.busy,
            ranking_source: server ? 'server' : 'local',
            server_next_ask: server?.nextAsk ?? null,
            candidates: decision.trace.candidates,
            reasons: decision.trace.reasons,
            route: session.route,
            session_count: session.count,
        }
        if (IS_DEV) console.debug('[attention]', payload)
        posthog.capture(ANALYTICS_EVENTS.ATTENTION_DECIDED, payload)
    }, [decision, state.userId, state.userLoaded, session.busy, session.route, session.count, server])
}

/**
 * The provider wraps the whole app shell. A throw inside it (a selector,
 * a hook, decide) must never take the app down with it: the boundary
 * renders the children without the manager and pages Sentry.
 */
class AttentionBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        Sentry.captureException(error, {
            tags: { feature: 'attention' },
            extra: { componentStack: info.componentStack },
        })
    }
    render() {
        return this.state.failed ? (
            this.props.children
        ) : (
            <AttentionProviderInner>{this.props.children}</AttentionProviderInner>
        )
    }
}

export function AttentionProvider({ children }: { children: ReactNode }) {
    return <AttentionBoundary>{children}</AttentionBoundary>
}

const LEGACY_EVENT: Record<SettleOutcome, string> = {
    acted: ANALYTICS_EVENTS.MODAL_CTA_CLICKED,
    dismissed: ANALYTICS_EVENTS.MODAL_DISMISSED,
    snoozed: ANALYTICS_EVENTS.MODAL_DISMISSED,
}
const ATTENTION_EVENT: Record<SettleOutcome, string> = {
    acted: ANALYTICS_EVENTS.ATTENTION_ACTED,
    dismissed: ANALYTICS_EVENTS.ATTENTION_DISMISSED,
    snoozed: ANALYTICS_EVENTS.ATTENTION_SNOOZED,
}

function AttentionProviderInner({ children }: { children: ReactNode }) {
    const state = useJourneyState()
    const ledger = useLedger(state.userId, state.serverLedger)
    const [openInterrupt, setOpenInterrupt] = useState<AskId | null>(null)

    // an account switch or logout drops whatever was on screen and the session
    // counters. Not on mount: a child surface's effect runs before this one
    // and may already have reported itself open.
    if (getSessionInterrupts().userId !== state.userId) {
        setSessionInterrupts({ userId: state.userId, ids: [], open: null })
    }
    const previousUserId = useRef(state.userId)
    useEffect(() => {
        if (previousUserId.current === state.userId) return
        previousUserId.current = state.userId
        setOpenInterrupt(null)
    }, [state.userId])

    const session = useSession(state, openInterrupt)
    const server = useServerAttention()
    const asks = useMemo(() => applyServerRanking(ASKS, server), [server])
    const askOf = useCallback((id: AskId) => asks.find((ask) => ask.id === id), [asks])
    const decision = useMemo(() => decide(state, asks, ledger, session), [state, asks, ledger, session])
    useDecisionReport(decision, state, session, server)
    // a settle checks against the latest pick, not the closure it was created in
    const latestDecision = useRef(decision)
    latestDecision.current = decision
    // the zone card already settled this pick: a second tap in the same tick writes nothing
    const settledSurfaces = useRef<Partial<Record<Surface, AskId>>>({})
    const pickId = (surface: Exclude<Surface, 'interrupt'>) =>
        surface === 'banner' ? decision.banner : decision[surface]?.id
    for (const surface of ['zone', 'inline', 'banner'] as const) {
        if (pickId(surface) !== settledSurfaces.current[surface]) delete settledSurfaces.current[surface]
    }
    const latestUserId = useRef(state.userId)
    if (latestUserId.current !== state.userId) settledSurfaces.current = {}
    latestUserId.current = state.userId
    if (surfacesShownThisSession.userId !== state.userId) surfacesShownThisSession = { userId: state.userId, keys: [] }

    // the decision closed the open surface itself (its verdict left `show`)
    useEffect(() => {
        if (openInterrupt && decision.interrupt !== openInterrupt) {
            setSessionInterrupts({ ...getSessionInterrupts(), open: null })
            setOpenInterrupt(null)
        }
    }, [decision.interrupt, openInterrupt])

    const userId = state.userId
    const opened = useCallback(
        (id: AskId) => {
            if (!userId) return
            const current = getSessionInterrupts()
            // the bookkeeping is once per show; the state sync is unconditional
            if (current.open !== id) {
                const ask = askOf(id)
                setSessionInterrupts({
                    ...current,
                    open: id,
                    ids: current.ids.includes(id) ? current.ids : [...current.ids, id],
                })
                ledgerActions.shown(userId, id, Date.now(), 'interrupt', session.count)
                posthog.capture(ANALYTICS_EVENTS.ATTENTION_SHOWN, { ask: id, surface: 'interrupt', tier: ask?.tier })
                if (ask) posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: ask.analyticsKey })
            }
            setOpenInterrupt(id)
        },
        [userId, session.count, askOf]
    )

    const openedSurface = useCallback(
        (id: AskId, surface: Exclude<Surface, 'interrupt'>) => {
            const key = `${surface}:${id}`
            const pick = surface === 'banner' ? latestDecision.current.banner : latestDecision.current[surface]?.id
            if (
                !userId ||
                latestUserId.current !== userId ||
                pick !== id ||
                surfacesShownThisSession.keys.includes(key)
            )
                return
            const ask = askOf(id)
            surfacesShownThisSession = { userId, keys: [...surfacesShownThisSession.keys, key] }
            // what rotation counts: lastSessionShown and consecutiveSessions
            ledgerActions.shown(userId, id, Date.now(), surface, session.count)
            posthog.capture(ANALYTICS_EVENTS.ATTENTION_SHOWN, { ask: id, surface, tier: ask?.tier })
        },
        [userId, session.count, askOf]
    )
    const openedZone = useCallback((id: AskId) => openedSurface(id, 'zone'), [openedSurface])

    const settle = useCallback(
        (id: AskId, outcome: SettleOutcome, until: number | undefined, surface: Surface) => {
            // a handler for an ask that is not on screen (a double tap, a stale closure) writes nothing
            if (!userId || latestUserId.current !== userId) return
            const onScreen =
                surface === 'interrupt'
                    ? getSessionInterrupts().open === id
                    : (surface === 'banner' ? latestDecision.current.banner : latestDecision.current[surface]?.id) ===
                          id && settledSurfaces.current[surface] !== id
            if (!onScreen) return
            if (surface !== 'interrupt') settledSurfaces.current[surface] = id
            const ask = askOf(id)
            const now = Date.now()
            const version = ask?.version?.(state)
            if (outcome === 'snoozed') {
                const days = ask?.policy.snoozeDays ?? 7
                ledgerActions.snoozed(userId, id, until ?? now + days * DAY_MS, version)
            } else {
                ledgerActions.dismissed(userId, id, now, version)
            }
            posthog.capture(ATTENTION_EVENT[outcome], { ask: id, surface, tier: ask?.tier })
            if (surface === 'interrupt') {
                // the legacy modal events, so the dashboards keep working; cards never had them
                if (ask) posthog.capture(LEGACY_EVENT[outcome], { modal_type: ask.analyticsKey })
                setSessionInterrupts({ ...getSessionInterrupts(), open: null })
                setOpenInterrupt(null)
            }
            bumpJourneyEpoch()
        },
        [userId, state, askOf]
    )

    const crashed = useCallback(
        (id: AskId, surface: Surface = 'interrupt') => {
            // the throw may land before the surface reported itself open
            if (surface === 'interrupt') setSessionInterrupts({ ...getSessionInterrupts(), open: id })
            settle(id, 'dismissed', undefined, surface)
        },
        [settle]
    )

    const value = useMemo<AttentionContextValue>(
        () => ({
            decision,
            state,
            ledger,
            session,
            asks,
            opened,
            openedZone,
            openedSurface,
            crashed,
            acted: (id, surface = 'interrupt') => settle(id, 'acted', undefined, surface),
            dismissed: (id, surface = 'interrupt') => settle(id, 'dismissed', undefined, surface),
            snoozed: (id, until, surface = 'interrupt') => settle(id, 'snoozed', until, surface),
        }),
        [decision, state, ledger, session, asks, opened, openedZone, openedSurface, crashed, settle]
    )

    return <AttentionContext.Provider value={value}>{children}</AttentionContext.Provider>
}

export function useAttention(): AttentionContextValue {
    const context = useContext(AttentionContext)
    if (!context) throw new Error('useAttention must be used within an AttentionProvider')
    return context
}

export function useAttentionOptional(): AttentionContextValue | undefined {
    return useContext(AttentionContext)
}
