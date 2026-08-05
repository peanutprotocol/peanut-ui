'use client'

import { useSyncExternalStore } from 'react'
import { DEMO_BALANCE_UNITS } from '@/constants/demo-data'

// Mutable, persisted demo wallet balance in token base units (USDC, 6 decimals).
// Debited on each simulated demo send (useSpendBundle) and persisted to
// localStorage so it survives app relaunch within a demo session. Entirely
// on-device (no backend) — the balance and its reset are per-device.
const KEY = 'peanut_demo_balance_units'
const TS_KEY = 'peanut_demo_balance_ts'
const DEMO_BALANCE_TTL_MS = 7 * 24 * 60 * 60 * 1000

let cache: bigint | undefined
const listeners = new Set<() => void>()

function readStored(): bigint | undefined {
    if (typeof window === 'undefined') return undefined
    try {
        const v = window.localStorage.getItem(KEY)
        return v == null ? undefined : BigInt(v)
    } catch {
        return undefined
    }
}

function readStoredTs(): number | undefined {
    if (typeof window === 'undefined') return undefined
    try {
        const v = window.localStorage.getItem(TS_KEY)
        return v == null ? undefined : Number(v)
    } catch {
        return undefined
    }
}

function persist(units: bigint): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(KEY, units.toString())
    } catch {}
}

function isStale(): boolean {
    const ts = readStoredTs()
    return ts === undefined || Number.isNaN(ts) || Date.now() - ts >= DEMO_BALANCE_TTL_MS
}

export function getDemoBalanceUnits(): bigint {
    if (cache === undefined) {
        // Once per session (on first read, before React subscribes): auto-refill a
        // demo wallet untouched for longer than the TTL so a spent-down balance
        // can't stay at 0 forever. Per-device — keyed off this device's timestamp.
        if (isStale()) resetDemoBalance()
        else cache = readStored() ?? DEMO_BALANCE_UNITS
    }
    return cache!
}

export function debitDemoBalance(units: bigint): void {
    const next = getDemoBalanceUnits() - units
    cache = next > 0n ? next : 0n
    persist(cache)
    listeners.forEach((l) => l())
}

/**
 * Refill this device's demo wallet to the full starting balance and restart the
 * 7-day TTL window. Called automatically by getDemoBalanceUnits() when the
 * persisted balance is older than DEMO_BALANCE_TTL_MS.
 */
export function resetDemoBalance(): void {
    cache = DEMO_BALANCE_UNITS
    persist(cache)
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(TS_KEY, Date.now().toString())
        } catch {}
    }
    listeners.forEach((l) => l())
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => {
        listeners.delete(listener)
    }
}

/** Reactive demo balance (re-renders consumers when debited). */
export function useDemoBalanceUnits(): bigint {
    return useSyncExternalStore(subscribe, getDemoBalanceUnits, getDemoBalanceUnits)
}
