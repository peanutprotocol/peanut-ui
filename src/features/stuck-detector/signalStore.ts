'use client'

import { isBankDepositPath } from './routeJourney'
import { subscribeStuckSignals, type StuckSignalKind } from './signalTap'
import type { PasskeyStepState, StuckSessionFlags } from './types'

const RAGE_WINDOW_MS = 1_500
const RAGE_RADIUS_PX = 28
const RAGE_CLICK_COUNT = 3
const IDLE_THRESHOLD_MS = 25_000
/** Reset session-scoped flags and nudge cap after 30 minutes away (native documents live up to 12h). */
export const SESSION_RESET_IDLE_MS = 30 * 60_000

export interface StuckRuntimeSnapshot {
    pathname: string
    /** Accumulated active visible dwell on the current screen/step (ms; paused while document is hidden). */
    activeDwellMs: number
    /** Accumulated active visible idle time since last interaction (ms; paused while document is hidden). */
    activeIdleMs: number
    /** Monotonic wall-clock timestamp of the last processed tick or visibility resume. */
    lastTickAt: number
    /** Wall-clock timestamp of last user interaction (used only to detect 30-min session boundary). */
    lastWallInteractionAt: number
    isDocumentVisible: boolean
    isDepositDetailsStep: boolean
    flags: StuckSessionFlags
    localVerifyAttempts: number
    passkeyCancelCount: number
    corridorSwitchCount: number
    errorRetryCount: number
    passkeyStepState: PasskeyStepState
    isFlowBusy: boolean
    sessionNudgeShown: boolean
    /** Key (`pathname:surface`) of the currently visible impression so marking the session cap never unmounts the active buddy mid-visit. */
    activeImpressionKey: string | null
    lastErrorCode: string | null
    /** Bumped every time state mutates so `useSyncExternalStore` re-renders cleanly. */
    version: number
}

const initialFlags = (): StuckSessionFlags => ({
    appError: false,
    rageTaps: false,
    longIdle: false,
    moneyFailed: false,
    moneyStuck: false,
    kycBlocked: false,
})

const createInitialState = (now = Date.now()): StuckRuntimeSnapshot => ({
    pathname: '',
    activeDwellMs: 0,
    activeIdleMs: 0,
    lastTickAt: now,
    lastWallInteractionAt: now,
    isDocumentVisible: true,
    isDepositDetailsStep: false,
    flags: initialFlags(),
    localVerifyAttempts: 0,
    passkeyCancelCount: 0,
    corridorSwitchCount: 0,
    errorRetryCount: 0,
    passkeyStepState: 'inactive',
    isFlowBusy: false,
    sessionNudgeShown: false,
    activeImpressionKey: null,
    lastErrorCode: null,
    version: 0,
})

let state: StuckRuntimeSnapshot = createInitialState()
const subscribers = new Set<() => void>()
const recentClicks: Array<{ target: EventTarget | null; x: number; y: number; at: number }> = []
let subscribedToTap = false

function notify(): void {
    state = { ...state, version: state.version + 1 }
    subscribers.forEach((fn) => fn())
}

function handleTapSignal(kind: StuckSignalKind, eventName: string): void {
    const nextFlags = { ...state.flags }
    let passkeyCancelCount = state.passkeyCancelCount
    let errorRetryCount = state.errorRetryCount
    let lastErrorCode = state.lastErrorCode

    switch (kind) {
        case 'appError':
            nextFlags.appError = true
            errorRetryCount += 1
            lastErrorCode = eventName
            break
        case 'moneyFailed':
            nextFlags.moneyFailed = true
            errorRetryCount += 1
            lastErrorCode = eventName
            break
        case 'moneyStuck':
            nextFlags.moneyStuck = true
            break
        case 'kycBlocked':
            nextFlags.kycBlocked = true
            lastErrorCode = eventName
            break
        case 'passkeyCancel':
            passkeyCancelCount += 1
            lastErrorCode = eventName
            break
        case 'rageClick':
            nextFlags.rageTaps = true
            break
    }

    state = {
        ...state,
        flags: nextFlags,
        passkeyCancelCount,
        errorRetryCount,
        lastErrorCode,
    }
    notify()
}

function ensureTapSubscription(): void {
    if (subscribedToTap) return
    subscribedToTap = true
    subscribeStuckSignals(handleTapSignal)
}

export function subscribeStuckRuntime(listener: () => void): () => void {
    ensureTapSubscription()
    subscribers.add(listener)
    return () => {
        subscribers.delete(listener)
    }
}

export function getStuckRuntimeSnapshot(): StuckRuntimeSnapshot {
    ensureTapSubscription()
    return state
}

function maybeResetStaleSession(now: number): void {
    if (now - state.lastWallInteractionAt < SESSION_RESET_IDLE_MS) return
    recentClicks.length = 0
    state = {
        ...createInitialState(now),
        pathname: state.pathname,
        isDocumentVisible: state.isDocumentVisible,
        isDepositDetailsStep: state.isDepositDetailsStep,
        passkeyStepState: state.passkeyStepState,
        isFlowBusy: state.isFlowBusy,
        version: state.version,
    }
}

export function setStuckRoute(pathname: string, now = Date.now()): void {
    maybeResetStaleSession(now)
    if (state.pathname === pathname) return
    const switchedDepositCorridor =
        isBankDepositPath(state.pathname) && isBankDepositPath(pathname) && state.pathname !== pathname
    const nextCorridorSwitchCount = switchedDepositCorridor ? state.corridorSwitchCount + 1 : 0
    recentClicks.length = 0
    state = {
        ...state,
        pathname,
        activeDwellMs: 0,
        activeIdleMs: 0,
        lastTickAt: now,
        lastWallInteractionAt: now,
        corridorSwitchCount: nextCorridorSwitchCount,
        localVerifyAttempts: pathname === '/verify' || pathname.startsWith('/verify/') ? state.localVerifyAttempts : 0,
        passkeyCancelCount: pathname === '/setup' || pathname.startsWith('/setup/') ? state.passkeyCancelCount : 0,
        errorRetryCount: 0,
        activeImpressionKey: null,
        flags: {
            ...state.flags,
            longIdle: false,
            rageTaps: false,
            moneyStuck: nextCorridorSwitchCount >= 2,
        },
    }
    notify()
}

/** Called on `visibilitychange`: pauses active dwell/idle clocks while the user is in another app (e.g. bank app). */
export function setStuckDocumentVisible(visible: boolean, now = Date.now()): void {
    if (state.isDocumentVisible === visible) return
    if (visible) {
        maybeResetStaleSession(now)
        state = {
            ...state,
            isDocumentVisible: true,
            lastTickAt: now,
        }
    } else {
        const delta = Math.max(0, now - state.lastTickAt)
        state = {
            ...state,
            isDocumentVisible: false,
            activeDwellMs: state.activeDwellMs + delta,
            activeIdleMs: state.activeIdleMs + delta,
            lastTickAt: now,
        }
    }
    notify()
}

/** Resets active idle timer on any real activity (`keydown`, `input`, `scroll`, `click`). */
export function noteUserActivity(now = Date.now()): void {
    maybeResetStaleSession(now)
    const wasIdle = state.flags.longIdle
    state = {
        ...state,
        activeIdleMs: 0,
        lastWallInteractionAt: now,
        lastTickAt: now,
        flags: wasIdle ? { ...state.flags, longIdle: false } : state.flags,
    }
    if (wasIdle) notify()
}

/**
 * Same-element rapid `click` detector (ignores scroll flicks and `data-stuck-ignore` elements).
 * Complements PostHog `$rageclick` from `signalTap.ts`.
 */
export function noteElementClick(
    target: EventTarget | null,
    x: number,
    y: number,
    ignored: boolean,
    now = Date.now()
): void {
    noteUserActivity(now)
    if (ignored || !target) return
    recentClicks.push({ target, x, y, at: now })
    while (recentClicks.length > 0 && now - recentClicks[0].at > RAGE_WINDOW_MS) {
        recentClicks.shift()
    }
    const cluster = recentClicks.filter((c) => c.target === target && Math.hypot(c.x - x, c.y - y) <= RAGE_RADIUS_PX)
    if (cluster.length >= RAGE_CLICK_COUNT && !state.flags.rageTaps) {
        state = { ...state, flags: { ...state.flags, rageTaps: true } }
        notify()
    }
}

/** Advances active visible dwell and idle clocks; no-ops while document is hidden. */
export function evaluateIdleTick(now = Date.now()): void {
    if (!state.isDocumentVisible) {
        state = { ...state, lastTickAt: now }
        return
    }
    maybeResetStaleSession(now)
    const delta = Math.max(0, Math.min(now - state.lastTickAt, 30_000))
    if (delta === 0) return
    const nextDwell = state.activeDwellMs + delta
    const nextIdle = state.activeIdleMs + delta
    const nextLongIdle = nextIdle >= IDLE_THRESHOLD_MS
    state = {
        ...state,
        activeDwellMs: nextDwell,
        activeIdleMs: nextIdle,
        lastTickAt: now,
        flags: nextLongIdle !== state.flags.longIdle ? { ...state.flags, longIdle: nextLongIdle } : state.flags,
    }
    notify()
}

export function noteLocalVerifyFieldError(attemptsOnField: number): void {
    state = {
        ...state,
        localVerifyAttempts: Math.max(state.localVerifyAttempts, attemptsOnField),
        flags: { ...state.flags, kycBlocked: true },
        lastErrorCode: 'verify_field_error',
    }
    notify()
}

export function setDepositDetailsStepActive(active: boolean, now = Date.now()): void {
    if (state.isDepositDetailsStep === active) return
    state = {
        ...state,
        isDepositDetailsStep: active,
        // Reset dwell when actually entering the deposit-details step so loading/ToS/amount time never counts.
        activeDwellMs: active ? 0 : state.activeDwellMs,
        lastTickAt: now,
    }
    notify()
}

export function setPasskeyStepState(nextState: PasskeyStepState, now = Date.now()): void {
    if (state.passkeyStepState === nextState) return
    const enteringReady = nextState === 'ready' && state.passkeyStepState !== 'ready'
    state = {
        ...state,
        passkeyStepState: nextState,
        // Reset dwell when entering the live passkey step so earlier `/setup` steps never count.
        activeDwellMs: enteringReady ? 0 : state.activeDwellMs,
        lastTickAt: now,
    }
    notify()
}

export function setStuckFlowBusy(isBusy: boolean): void {
    if (state.isFlowBusy === isBusy) return
    state = { ...state, isFlowBusy: isBusy }
    notify()
}

export function markSessionNudgeShown(impressionKey?: string): void {
    const nextKey = impressionKey ?? null
    if (state.sessionNudgeShown && state.activeImpressionKey === nextKey) return
    state = { ...state, sessionNudgeShown: true, activeImpressionKey: nextKey }
    notify()
}

export function clearActiveImpression(): void {
    if (state.activeImpressionKey === null) return
    state = { ...state, activeImpressionKey: null }
    notify()
}

export function resetStuckRuntimeForTests(now = Date.now()): void {
    recentClicks.length = 0
    state = createInitialState(now)
    notify()
}
