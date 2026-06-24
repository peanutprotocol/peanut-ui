'use client'

import { useSyncExternalStore } from 'react'
import { DEMO_BALANCE_UNITS } from '@/constants/demo-data'

// Mutable, persisted demo wallet balance in token base units (USDC, 6 decimals).
// Debited on each simulated demo send (useSpendBundle) and persisted to
// localStorage so it survives app relaunch within a demo session. Defaults to
// DEMO_BALANCE_UNITS on a fresh install (no stored value).
const KEY = 'peanut_demo_balance_units'

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

function persist(units: bigint): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(KEY, units.toString())
    } catch {}
}

export function getDemoBalanceUnits(): bigint {
    if (cache === undefined) cache = readStored() ?? DEMO_BALANCE_UNITS
    return cache
}

export function debitDemoBalance(units: bigint): void {
    const next = getDemoBalanceUnits() - units
    cache = next > 0n ? next : 0n
    persist(cache)
    listeners.forEach((l) => l())
}

/** Start a fresh demo with the full balance (call on demo entry). */
export function resetDemoBalance(): void {
    cache = DEMO_BALANCE_UNITS
    persist(cache)
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
