'use client'

import {
    Component,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
    type ErrorInfo,
    type ReactNode,
} from 'react'
import { usePathname } from 'next/navigation'
import posthog from 'posthog-js'
import * as Sentry from '@sentry/nextjs'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { IS_DEV } from '@/constants/general.consts'
import { useKillSwitches } from '@/features/kill-switches/useKillSwitches'
import { useAnyOverlayOpen } from '@/utils/overlay-visibility'
import { useModalsContextOptional } from '@/context/ModalsContext'
import { decide } from './decide'
import { guardAsks, resetAttentionFaultsForTests } from './faults'
import { getSessionInterrupts, setSessionInterrupts } from './interruptState'
import {
    ledgerActions,
    noteServerLedger,
    persistLegacyLedger,
    readLedger,
    resetLedgerMemoryForTests,
    subscribeLedger,
} from './ledger'
import { bumpJourneyEpoch } from './journeyEpoch'
import { useJourneyState } from './journeyState'
import { ASKS } from './registry'
import { applyServerRanking, useServerAttention, type ServerAttention } from './serverAttention'
import { countSession, resetSessionCountForTests, useSessionCount } from './sessionCount'
import { useMountedSlots } from './slotStore'
import { DEFAULT_SETTINGS } from './catalogue'
import type { AskId, AttentionAsk, Decision, JourneyState, Ledger, Session, Surface } from './types'

export { isAttentionInterruptOpen } from './interruptState'

/** how long an `unknown` ask may hold lower-priority interrupts (same ceiling as useFlagsSettled) */
export const SETTLE_DEADLINE_MS = DEFAULT_SETTINGS.settleMs

const DAY_MS = 24 * 60 * 60 * 1000

export type SettleOutcome = 'acted' | 'dismissed' | 'snoozed'

export interface AttentionContextValue {
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
    /** the surface threw: skip the ask for this load; the ledger is not touched */
    crashed: (id: AskId, surface?: Surface) => void
    /** the user did the thing; completion itself is derived from state */
    acted: (id: AskId, surface?: Surface) => void
    recordLegalAcceptance: () => void
    holdPushPrompt: (hold: boolean) => void
    holdPushCard: (hold: boolean) => void
    /** a CTA on the surface was used without settling the ask (the store link): reported, nothing written */
    action: (id: AskId, properties?: { cta?: string }, surface?: Surface) => void
    dismissed: (id: AskId, surface?: Surface) => void
    snoozed: (id: AskId, until?: number, surface?: Surface) => void
}

const AttentionContext = createContext<AttentionContextValue | undefined>(undefined)

const EMPTY_LEDGER: Ledger = {}
const EMPTY_IDS: readonly AskId[] = []

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
    crashedThisLoad.clear()
    resetLedgerMemoryForTests()
    resetSessionCountForTests()
    resetAttentionFaultsForTests()
}

// per account, the asks whose surface threw this app load
const crashedThisLoad = new Map<string, readonly AskId[]>()
const crashedFor = (userId: string | null): readonly AskId[] => (userId && crashedThisLoad.get(userId)) || EMPTY_IDS

// the zone cards already booked this app load, for which account
let surfacesShownThisSession: { userId: string | null; keys: string[] } = { userId: null, keys: [] }

/**
 * Each ask that reads `unknown` holds lower asks for SETTLE_DEADLINE_MS from
 * when it turned `unknown` on the current route: a check that starts late
 * (the arrival check starts on Home) still gets its window.
 */
function useSettleDeadline(
    userId: string | null,
    route: JourneyState['route'],
    unknown: readonly AskId[],
    settleMs: number
): boolean {
    const since = useRef<{ userId: string | null; route: string; at: Map<AskId, number> }>({
        userId,
        route,
        at: new Map(),
    })
    const [, setTick] = useState(0)
    if (since.current.userId !== userId || since.current.route !== route) {
        since.current = { userId, route, at: new Map() }
    }
    const now = Date.now()
    const at = since.current.at
    for (const id of [...at.keys()]) if (!unknown.includes(id)) at.delete(id)
    for (const id of unknown) if (!at.has(id)) at.set(id, now)
    const remaining = Math.max(0, ...unknown.map((id) => (at.get(id) ?? now) + settleMs - now))
    const passed = !userId || remaining === 0
    useEffect(() => {
        if (passed) return undefined
        const timer = setTimeout(() => setTick((tick) => tick + 1), remaining)
        return () => clearTimeout(timer)
    }, [passed, remaining])
    return passed
}

function useSession(
    state: JourneyState,
    openInterrupt: AskId | null,
    crashed: readonly AskId[],
    settleDeadlinePassed: boolean
): Session {
    const overlayOpen = useAnyOverlayOpen()
    const modals = useModalsContextOptional()
    // the scanner and the passkey interstitial are full-screen flows outside the drawer/modal registry
    const busy =
        overlayOpen ||
        !!modals?.isQRScannerOpen ||
        !!modals?.isSecurityVerificationOpen ||
        !!modals?.isSupportModalOpen ||
        !!modals?.isGetAppModalOpen ||
        !!modals?.isSignInModalOpen
    const slots = useMountedSlots()

    // this load is counted before the first decision reads the count
    if (state.userId) countSession(state.userId)
    const count = useSessionCount(state.userId)
    const current = getSessionInterrupts()
    return useMemo(
        () => ({
            slots,
            count,
            route: state.route,
            interruptsThisSession: current.userId === state.userId ? current.ids : [],
            openInterrupt,
            busy,
            // the mobile layout swaps the whole tree for its gates (offline, backend
            // down, auth), so while this provider is mounted no gate is up
            gateUp: false,
            settleDeadlinePassed,
            crashed,
        }),
        [count, state.route, current, state.userId, openInterrupt, busy, settleDeadlinePassed, slots, crashed]
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
        const key = `${state.userId}:${decision.interrupt}:${decision.zone?.id ?? null}:${decision.zone?.mode ?? ''}:${decision.zone?.underlay ?? ''}:${decision.inline?.id ?? null}:${decision.inline?.slot ?? null}:${decision.banner}:${decision.suspended}:${server ? 'server' : 'local'}:${server?.nextAsk ?? null}`
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

/** engine restarts per app load after a crash, one per route change */
export const ENGINE_RETRIES = 2

type EngineFailure = { route: string | null } | null

/**
 * A throw inside the engine (a selector, a hook, decide) pages Sentry and
 * clears the decision, so every host renders nothing. The engine starts again
 * on the next route, at most ENGINE_RETRIES times per load: data that broke it
 * once does not end the prompts for the rest of the session.
 */
class EngineBoundary extends Component<
    { route: string | null; onFailed: () => void; children: ReactNode },
    { failed: boolean; failedOn: EngineFailure; retries: number }
> {
    state = { failed: false, failedOn: null as EngineFailure, retries: 0 }
    static getDerivedStateFromError() {
        return { failed: true }
    }
    componentDidCatch(error: Error, info: ErrorInfo) {
        setSessionInterrupts({ ...getSessionInterrupts(), open: null })
        Sentry.captureException(error, {
            tags: { feature: 'attention' },
            extra: { componentStack: info.componentStack, retries: this.state.retries },
        })
        this.setState({ failedOn: { route: this.props.route } })
        this.props.onFailed()
    }
    componentDidUpdate() {
        const { failed, failedOn, retries } = this.state
        if (failed && failedOn && failedOn.route !== this.props.route && retries < ENGINE_RETRIES)
            this.setState({ failed: false, failedOn: null, retries: retries + 1 })
    }
    render() {
        return this.state.failed ? null : this.props.children
    }
}

/**
 * The engine runs beside the app, not around it: a throw inside it never
 * unmounts a page or loses what the user typed, and a page's own error goes
 * straight to the app's boundary.
 */
export function AttentionProvider({ children }: { children: ReactNode }) {
    const [value, setValue] = useState<AttentionContextValue | undefined>(undefined)
    const route = usePathname()
    const clear = useCallback(() => setValue(undefined), [])
    return (
        <AttentionContext.Provider value={value}>
            <EngineBoundary route={route} onFailed={clear}>
                <AttentionEngine publish={setValue} />
            </EngineBoundary>
            {children}
        </AttentionContext.Provider>
    )
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

function AttentionEngine({ publish }: { publish: (value: AttentionContextValue | undefined) => void }) {
    const state = useJourneyState()
    const ledger = useLedger(state.userId, state.serverLedger)
    const [openInterrupt, setOpenInterrupt] = useState<AskId | null>(null)
    const [heldPushUser, setHeldPushUser] = useState<string | null>(null)
    const [heldPushCardUser, setHeldPushCardUser] = useState<string | null>(null)

    // an account switch or logout drops whatever was on screen and the session
    // counters. Not on mount: a child surface's effect runs before this one
    // and may already have reported itself open.
    if (getSessionInterrupts().userId !== state.userId) {
        setSessionInterrupts({ userId: state.userId, ids: [], open: null })
    }
    useEffect(() => {
        if (state.userId) persistLegacyLedger(state.userId)
    }, [state.userId])
    // nothing this provider opened stays "open" once it is gone (the push store reads it)
    useEffect(
        () => () => {
            if (getSessionInterrupts().open) setSessionInterrupts({ ...getSessionInterrupts(), open: null })
        },
        []
    )
    const previousUserId = useRef(state.userId)
    useEffect(() => {
        if (previousUserId.current === state.userId) return
        previousUserId.current = state.userId
        setOpenInterrupt(null)
        setHeldPushUser(null)
        setHeldPushCardUser(null)
    }, [state.userId])

    const [, setCrashCount] = useState(0)
    const server = useServerAttention()
    const { disabledAttentionAsks } = useKillSwitches()
    const asks = useMemo(
        () => guardAsks(applyServerRanking(ASKS, server), disabledAttentionAsks),
        [server, disabledAttentionAsks]
    )
    const unknownKey = asks
        .filter((ask) => ask.eligible(state) === 'unknown')
        .map((ask) => ask.id)
        .join(',')
    const unknown = useMemo(() => (unknownKey ? (unknownKey.split(',') as AskId[]) : EMPTY_IDS), [unknownKey])
    const settings = state.attentionSettings ?? DEFAULT_SETTINGS
    const settleDeadlinePassed = useSettleDeadline(state.userId, state.route, unknown, settings.settleMs)
    const session = useSession(state, openInterrupt, crashedFor(state.userId), settleDeadlinePassed)
    const askOf = useCallback((id: AskId) => asks.find((ask) => ask.id === id), [asks])
    const decision = useMemo(() => {
        const next = decide(state, asks, ledger, session)
        const mayHoldPush =
            !disabledAttentionAsks.includes('*') &&
            !disabledAttentionAsks.includes('push-home-fallback') &&
            !session.crashed?.includes('push-home-fallback')
        const interrupt =
            mayHoldPush &&
            heldPushUser &&
            heldPushUser === state.userId &&
            session.route === 'home' &&
            !session.gateUp &&
            !session.busy &&
            openInterrupt === 'push-home-fallback' &&
            !next.interrupt
                ? ('push-home-fallback' as const)
                : next.interrupt
        const selectedTier = asks.find((ask) => ask.id === next.zone?.id)?.tier
        const zone =
            mayHoldPush &&
            heldPushCardUser &&
            heldPushCardUser === state.userId &&
            session.route === 'home' &&
            !session.gateUp &&
            !session.busy &&
            !interrupt &&
            (!next.zone || (selectedTier !== undefined && selectedTier > 1))
                ? { id: 'push-home-fallback' as const, mode: 'ask' as const }
                : next.zone
        return { ...next, interrupt, zone }
    }, [state, asks, ledger, session, heldPushUser, heldPushCardUser, openInterrupt, disabledAttentionAsks])
    useDecisionReport(decision, state, session, server)
    // a settle checks against the latest pick, not the closure it was created in
    const latestDecision = useRef(decision)
    latestDecision.current = decision
    const latestState = useRef(state)
    latestState.current = state
    // the zone card already settled this pick: a second tap in the same tick writes nothing
    const settledSurfaces = useRef<Partial<Record<Surface, AskId>>>({})
    const pickId = (surface: Exclude<Surface, 'interrupt'>) =>
        surface === 'banner' ? decision.banner : decision[surface]?.id
    for (const surface of ['zone', 'inline', 'banner'] as const) {
        if (pickId(surface) !== settledSurfaces.current[surface]) delete settledSurfaces.current[surface]
    }
    const acceptedLegalVersions = useRef(new Set<string>())
    const latestUserId = useRef(state.userId)
    const accountGeneration = useRef(0)
    if (latestUserId.current !== state.userId) {
        settledSurfaces.current = {}
        accountGeneration.current += 1
    }
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
            if (!userId || crashedFor(userId).includes(id)) return
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
                if (ask)
                    posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, {
                        ...ask.legacyProps?.(latestState.current, 'shown'),
                        modal_type: ask.analyticsKey,
                    })
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
                const days = ask?.policy.snoozeDays ?? settings.defaultSnoozeDays
                ledgerActions.snoozed(userId, id, until ?? now + days * DAY_MS, version)
            } else {
                ledgerActions.dismissed(userId, id, now, version)
            }
            const legalReported =
                id === 'legal-reconsent' &&
                outcome === 'acted' &&
                acceptedLegalVersions.current.has(`${userId}:${version}`)
            if (!legalReported) posthog.capture(ATTENTION_EVENT[outcome], { ask: id, surface, tier: ask?.tier })
            if (surface === 'interrupt') {
                // the legacy modal events, so the dashboards keep working; cards never had them
                if (ask && !legalReported)
                    posthog.capture(LEGACY_EVENT[outcome], {
                        ...ask.legacyProps?.(state, outcome),
                        modal_type: ask.analyticsKey,
                    })
                setSessionInterrupts({ ...getSessionInterrupts(), open: null })
                setOpenInterrupt(null)
            }
            bumpJourneyEpoch()
        },
        [userId, state, askOf, settings.defaultSnoozeDays]
    )

    const action = useCallback(
        (id: AskId, properties: { cta?: string } = {}, surface: Surface = 'interrupt') => {
            if (!userId || latestUserId.current !== userId) return
            const onScreen =
                surface === 'interrupt'
                    ? getSessionInterrupts().open === id
                    : (surface === 'banner' ? latestDecision.current.banner : latestDecision.current[surface]?.id) ===
                      id
            if (!onScreen) return
            const ask = askOf(id)
            posthog.capture(ANALYTICS_EVENTS.ATTENTION_ACTED, {
                ask: id,
                surface,
                tier: ask?.tier,
                settled: false,
                ...properties,
            })
            if (surface === 'interrupt' && ask)
                posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                    ...ask.legacyProps?.(state, 'acted'),
                    ...properties,
                    modal_type: ask.analyticsKey,
                })
        },
        [userId, state, askOf]
    )

    const crashed = useCallback(
        (id: AskId, surface: Surface = 'interrupt') => {
            if (!userId || latestUserId.current !== userId) return
            const known = crashedFor(userId)
            if (known.includes(id)) return
            crashedThisLoad.set(userId, [...known, id])
            setCrashCount((count) => count + 1)
            posthog.capture(ANALYTICS_EVENTS.ATTENTION_CRASHED, { ask: id, surface, tier: askOf(id)?.tier })
            if (surface === 'interrupt' && getSessionInterrupts().open === id) {
                setSessionInterrupts({ ...getSessionInterrupts(), open: null })
                setOpenInterrupt(null)
            }
        },
        [userId, askOf]
    )

    const holdPushPrompt = useCallback((hold: boolean) => setHeldPushUser(hold ? userId : null), [userId])
    const holdPushCard = useCallback((hold: boolean) => setHeldPushCardUser(hold ? userId : null), [userId])
    const legalVersion = askOf('legal-reconsent')?.version?.(state)
    const legalGeneration = accountGeneration.current
    const recordLegalAcceptance = useCallback(() => {
        if (!userId || latestUserId.current !== userId || accountGeneration.current !== legalGeneration) return
        const key = `${userId}:${legalVersion}`
        if (acceptedLegalVersions.current.has(key)) return
        acceptedLegalVersions.current.add(key)
        const ask = askOf('legal-reconsent')
        posthog.capture(ATTENTION_EVENT.acted, { ask: 'legal-reconsent', surface: 'interrupt', tier: ask?.tier })
        if (ask)
            posthog.capture(LEGACY_EVENT.acted, { ...ask.legacyProps?.(state, 'acted'), modal_type: ask.analyticsKey })
    }, [userId, legalVersion, legalGeneration, askOf, state])

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
            recordLegalAcceptance,
            holdPushPrompt,
            holdPushCard,
            acted: (id, surface = 'interrupt') => settle(id, 'acted', undefined, surface),
            action,
            dismissed: (id, surface = 'interrupt') => settle(id, 'dismissed', undefined, surface),
            snoozed: (id, until, surface = 'interrupt') => settle(id, 'snoozed', until, surface),
        }),
        [
            decision,
            state,
            ledger,
            session,
            asks,
            opened,
            openedZone,
            openedSurface,
            crashed,
            action,
            settle,
            recordLegalAcceptance,
            holdPushPrompt,
            holdPushCard,
        ]
    )

    // before paint: the hosts render this decision in the same frame
    useLayoutEffect(() => publish(value), [publish, value])
    useLayoutEffect(() => () => publish(undefined), [publish])
    return null
}

export function useAttention(): AttentionContextValue {
    const context = useContext(AttentionContext)
    if (!context) throw new Error('useAttention must be used within an AttentionProvider')
    return context
}

export function useAttentionOptional(): AttentionContextValue | undefined {
    return useContext(AttentionContext)
}
