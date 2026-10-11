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
import { ledgerActions, readLedger, subscribeLedger } from './ledger'
import { bumpJourneyEpoch } from './journeyEpoch'
import { useJourneyState } from './journeyState'
import { ASKS } from './registry'
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
    /** the surface threw: settle it as dismissed whether or not it had reported itself open */
    crashed: (id: AskId, surface?: Surface) => void
    /** the user did the thing; completion itself is derived from state */
    acted: (id: AskId, surface?: Surface) => void
    dismissed: (id: AskId, surface?: Surface) => void
    snoozed: (id: AskId, until?: number, surface?: Surface) => void
}

const AttentionContext = createContext<AttentionContextValue | undefined>(undefined)

const EMPTY_LEDGER: Ledger = {}

function useLedger(userId: string | null): Ledger {
    return useSyncExternalStore(
        subscribeLedger,
        () => readLedger(userId),
        () => EMPTY_LEDGER
    )
}

export function resetAttentionSessionForTests(): void {
    setSessionInterrupts({ userId: null, ids: [], open: null })
    zoneShownThisSession = { userId: null, ids: [] }
}

// the zone cards already booked this app load, for which account
let zoneShownThisSession: { userId: string | null; ids: AskId[] } = { userId: null, ids: [] }

const askOf = (id: AskId) => ASKS.find((ask) => ask.id === id)

function useSession(state: JourneyState, openInterrupt: AskId | null): Session {
    const busy = useAnyOverlayOpen()
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
        [state.userId, state.route, current, openInterrupt, busy, settleDeadlinePassed]
    )
}

/** One `attention_decided` per distinct decision, so the trace can be read against `modal_shown`. */
function useDecisionReport(decision: Decision, state: JourneyState, session: Session): void {
    const reported = useRef<string | null>(null)
    useEffect(() => {
        if (!state.userId || !state.userLoaded) return
        const key = `${state.userId}:${decision.interrupt}:${decision.zone?.id ?? null}:${decision.zone?.mode ?? ''}:${decision.suspended}`
        if (reported.current === key) return
        reported.current = key
        const payload = {
            shadow: false,
            interrupt: decision.interrupt,
            zone: decision.zone?.id ?? null,
            zone_mode: decision.zone?.mode ?? null,
            suspended: decision.suspended,
            overlay_open: session.busy,
            candidates: decision.trace.candidates,
            reasons: decision.trace.reasons,
            route: session.route,
            session_count: session.count,
        }
        if (IS_DEV) console.debug('[attention]', payload)
        posthog.capture(ANALYTICS_EVENTS.ATTENTION_DECIDED, payload)
    }, [decision, state.userId, state.userLoaded, session.busy, session.route, session.count])
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
    const ledger = useLedger(state.userId)
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
    const decision = useMemo(() => decide(state, ASKS, ledger, session), [state, ledger, session])
    useDecisionReport(decision, state, session)
    // a settle checks against the latest pick, not the closure it was created in
    const latestDecision = useRef(decision)
    latestDecision.current = decision
    // the zone card already settled this pick: a second tap in the same tick writes nothing
    const settledZone = useRef<AskId | null>(null)
    if (settledZone.current && decision.zone?.id !== settledZone.current) settledZone.current = null
    if (zoneShownThisSession.userId !== state.userId) zoneShownThisSession = { userId: state.userId, ids: [] }

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
        [userId, session.count]
    )

    const openedZone = useCallback(
        (id: AskId) => {
            if (!userId || zoneShownThisSession.ids.includes(id)) return
            const ask = askOf(id)
            zoneShownThisSession = { userId, ids: [...zoneShownThisSession.ids, id] }
            // what rotation counts: lastSessionShown and consecutiveSessions
            ledgerActions.shown(userId, id, Date.now(), 'zone', session.count)
            posthog.capture(ANALYTICS_EVENTS.ATTENTION_SHOWN, { ask: id, surface: 'zone', tier: ask?.tier })
        },
        [userId, session.count]
    )

    const settle = useCallback(
        (id: AskId, outcome: SettleOutcome, until: number | undefined, surface: Surface) => {
            // a handler for an ask that is not on screen (a double tap, a stale closure) writes nothing
            if (!userId) return
            const onScreen =
                surface === 'interrupt'
                    ? getSessionInterrupts().open === id
                    : latestDecision.current.zone?.id === id && settledZone.current !== id
            if (!onScreen) return
            if (surface === 'zone') settledZone.current = id
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
        [userId, state]
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
            asks: ASKS,
            opened,
            openedZone,
            crashed,
            acted: (id, surface = 'interrupt') => settle(id, 'acted', undefined, surface),
            dismissed: (id, surface = 'interrupt') => settle(id, 'dismissed', undefined, surface),
            snoozed: (id, until, surface = 'interrupt') => settle(id, 'snoozed', until, surface),
        }),
        [decision, state, ledger, session, opened, openedZone, crashed, settle]
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
