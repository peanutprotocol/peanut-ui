'use client'

import { emitStuckSignal, subscribeStuckSignals, type StuckSignalKind } from './signalTap'
import type { StuckSessionFlags } from './types'

const RAGE_WINDOW_MS = 1_500
const RAGE_RADIUS_PX = 28
const RAGE_TAP_COUNT = 3
const IDLE_THRESHOLD_MS = 25_000

export interface StuckRuntimeSnapshot {
    sessionStartedAt: number
    screenEnteredAt: number
    lastInteractionAt: number
    pathname: string
    flags: StuckSessionFlags
    localVerifyAttempts: number
    passkeyCancelCount: number
    corridorSwitchCount: number
    errorRetryCount: number
    isSetupErrorScreenOpen: boolean
    isFlowBusy: boolean
    sessionNudgeShown: boolean
    shadowLoggedForSession: boolean
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
    sessionStartedAt: now,
    screenEnteredAt: now,
    lastInteractionAt: now,
    pathname: '',
    flags: initialFlags(),
    localVerifyAttempts: 0,
    passkeyCancelCount: 0,
    corridorSwitchCount: 0,
    errorRetryCount: 0,
    isSetupErrorScreenOpen: false,
    isFlowBusy: false,
    sessionNudgeShown: false,
    shadowLoggedForSession: false,
    lastErrorCode: null,
    version: 0,
})

let state: StuckRuntimeSnapshot = createInitialState()
const subscribers = new Set<() => void>()
const recentTaps: Array<{ x: number; y: number; at: number }> = []
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

export function setStuckRoute(pathname: string, now = Date.now()): void {
    if (state.pathname === pathname) return
    const switchedDepositCorridor =
        state.pathname.startsWith('/add-money') && pathname.startsWith('/add-money') && state.pathname !== pathname
    state = {
        ...state,
        pathname,
        screenEnteredAt: now,
        lastInteractionAt: now,
        corridorSwitchCount: switchedDepositCorridor ? state.corridorSwitchCount + 1 : 0,
        localVerifyAttempts: pathname.startsWith('/verify') ? state.localVerifyAttempts : 0,
        errorRetryCount: 0,
        flags: {
            ...state.flags,
            longIdle: false,
            rageTaps: false,
            moneyStuck: switchedDepositCorridor && state.corridorSwitchCount + 1 >= 2 ? true : state.flags.moneyStuck,
        },
    }
    notify()
}

export function notePointerTap(x: number, y: number, ignored: boolean, now = Date.now()): void {
    state = { ...state, lastInteractionAt: now }
    if (ignored) return
    recentTaps.push({ x, y, at: now })
    while (recentTaps.length > 0 && now - recentTaps[0].at > RAGE_WINDOW_MS) {
        recentTaps.shift()
    }
    const cluster = recentTaps.filter((t) => Math.hypot(t.x - x, t.y - y) <= RAGE_RADIUS_PX)
    if (cluster.length >= RAGE_TAP_COUNT && !state.flags.rageTaps) {
        state = { ...state, flags: { ...state.flags, rageTaps: true } }
        notify()
    }
}

export function evaluateIdleTick(now = Date.now()): void {
    const idleMs = now - state.lastInteractionAt
    const onScreenMs = now - state.screenEnteredAt
    const nextIdle = idleMs >= IDLE_THRESHOLD_MS
    const nextMoneyStuck =
        state.pathname.startsWith('/add-money') && onScreenMs >= 45_000 ? true : state.flags.moneyStuck
    if (nextIdle !== state.flags.longIdle || nextMoneyStuck !== state.flags.moneyStuck) {
        state = {
            ...state,
            flags: {
                ...state.flags,
                longIdle: nextIdle,
                moneyStuck: nextMoneyStuck,
            },
        }
        notify()
    }
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

export function noteDepositFriction(): void {
    emitStuckSignal('moneyStuck', 'deposit_friction')
}

export function setSetupErrorScreenOpen(isOpen: boolean): void {
    if (state.isSetupErrorScreenOpen === isOpen) return
    state = { ...state, isSetupErrorScreenOpen: isOpen }
    notify()
}

export function setStuckFlowBusy(isBusy: boolean): void {
    if (state.isFlowBusy === isBusy) return
    state = { ...state, isFlowBusy: isBusy }
    notify()
}

export function markSessionNudgeShown(): void {
    if (state.sessionNudgeShown) return
    state = { ...state, sessionNudgeShown: true }
    notify()
}

export function markShadowLogged(): void {
    if (state.shadowLoggedForSession) return
    state = { ...state, shadowLoggedForSession: true }
    notify()
}

export function resetStuckRuntimeForTests(now = Date.now()): void {
    recentTaps.length = 0
    state = createInitialState(now)
    notify()
}
