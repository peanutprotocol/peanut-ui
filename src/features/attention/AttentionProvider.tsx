'use client'

import {
    Component,
    createContext,
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
import { ledgerActions, readLedger, subscribeLedger } from './ledger'
import { useJourneyState } from './journeyState'
import { ASKS } from './registry'
import type { AskId, AttentionAsk, Decision, JourneyState, Ledger, Session } from './types'

/** how long an `unknown` higher tier may hold lower-tier interrupts (same ceiling as useFlagsSettled) */
export const SETTLE_DEADLINE_MS = 4_000

interface AttentionContextValue {
    decision: Decision
    state: JourneyState
    ledger: Ledger
    session: Session
    asks: readonly AttentionAsk[]
    /** the user answered the ask; completion itself is derived from state */
    acted: (id: AskId) => void
    dismissed: (id: AskId) => void
    snoozed: (id: AskId, until?: number) => void
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

// per app load: the interrupts the arbiter opened, and for which account
let sessionInterrupts: { userId: string | null; ids: AskId[] } = { userId: null, ids: [] }

export function resetAttentionSessionForTests(): void {
    sessionInterrupts = { userId: null, ids: [] }
}

function useSession(state: JourneyState, openInterrupt: AskId | null): Session {
    const busy = useAnyOverlayOpen()
    const [settleDeadlinePassed, setSettleDeadlinePassed] = useState(false)

    useEffect(() => {
        setSettleDeadlinePassed(false)
        if (!state.userId) return undefined
        const timer = setTimeout(() => setSettleDeadlinePassed(true), SETTLE_DEADLINE_MS)
        return () => clearTimeout(timer)
    }, [state.userId])

    if (sessionInterrupts.userId !== state.userId) sessionInterrupts = { userId: state.userId, ids: [] }

    return {
        count: getUserPreferences(state.userId ?? undefined)?.sessionCount ?? 0,
        route: state.route,
        interruptsThisSession: sessionInterrupts.ids,
        openInterrupt,
        busy,
        // the mobile layout swaps the whole tree for its gates (offline, backend
        // down, auth), so while this provider is mounted no gate is up
        gateUp: false,
        settleDeadlinePassed,
    }
}

/**
 * Shadow mode (phase 1): nothing renders through the arbiter yet. It decides
 * next to the old prompts and reports what it would have shown, so the trace
 * can be compared against `modal_shown` before any surface moves over.
 */
function useShadowReport(state: JourneyState, ledger: Ledger, session: Session): void {
    const reported = useRef<string | null>(null)
    useEffect(() => {
        if (!state.userId || !state.userLoaded) return
        // every open overlay is a legacy prompt in phase 1, so the report
        // ignores `busy`: it must say what the arbiter would have picked
        const decision = decide(state, ASKS, ledger, { ...session, busy: false })
        const key = `${state.userId}:${decision.interrupt}:${decision.zone?.id ?? null}:${decision.zone?.mode ?? ''}`
        if (reported.current === key) return
        reported.current = key
        const payload = {
            shadow: true,
            interrupt: decision.interrupt,
            zone: decision.zone?.id ?? null,
            zone_mode: decision.zone?.mode ?? null,
            overlay_open: session.busy,
            candidates: decision.trace.candidates,
            reasons: decision.trace.reasons,
            route: session.route,
            session_count: session.count,
        }
        if (IS_DEV) console.debug('[attention]', payload)
        posthog.capture(ANALYTICS_EVENTS.ATTENTION_DECIDED, payload)
    }, [state, ledger, session])
}

/**
 * The provider wraps the whole app shell. A throw inside it (a selector,
 * a hook, decide) must never take the app down with it: the boundary
 * renders the children without the arbiter and pages Sentry.
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

function AttentionProviderInner({ children }: { children: ReactNode }) {
    const state = useJourneyState()
    const ledger = useLedger(state.userId)
    // phase 1: the arbiter owns no surface yet, so nothing is ever open through it
    const openInterrupt: AskId | null = null
    const session = useSession(state, openInterrupt)

    const decision = useMemo(() => decide(state, ASKS, ledger, session), [state, ledger, session])
    useShadowReport(state, ledger, session)

    const value = useMemo<AttentionContextValue>(() => {
        const userId = state.userId
        const askOf = (id: AskId) => ASKS.find((ask) => ask.id === id)
        return {
            decision,
            state,
            ledger,
            session,
            asks: ASKS,
            acted: (id) => {
                if (userId) ledgerActions.cleared(userId, id)
            },
            dismissed: (id) => {
                if (userId) ledgerActions.dismissed(userId, id, state.now, askOf(id)?.version?.(state))
            },
            snoozed: (id, until) => {
                if (!userId) return
                const days = askOf(id)?.policy.snoozeDays ?? 7
                ledgerActions.snoozed(
                    userId,
                    id,
                    until ?? state.now + days * 24 * 60 * 60 * 1000,
                    askOf(id)?.version?.(state)
                )
            },
        }
    }, [decision, state, ledger, session])

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
