'use client'

import { useCallback, useEffect, useState } from 'react'
import { getOfframpByTxHash } from '@/app/actions/offramp'
import * as Sentry from '@sentry/nextjs'

/**
 * In-flight off-ramp recovery.
 *
 * Reason this exists: PR #2147 added a `submittedTxHash` React state to the
 * withdraw bank page to prevent showing a Retry button after the on-chain
 * leg fired (Sentry PEANUT-UI-QH9 / 2026-06-01). That defuse is correct
 * within a single React session — but if the user reloads mid-flow (or the
 * mobile app gets killed), React state is gone and they're back to a clean
 * form. Submitting again would call sendMoney() twice → double-pay.
 *
 * This hook persists the in-flight {transferId, txHash} pair to localStorage
 * keyed by transferId. On mount, it restores any pending entries and queries
 * the BE recovery endpoint (GET /bridge/transfers/by-tx-hash/:txHash, added
 * in peanut-api-ts #929) to confirm the BE knows about each one. If the BE
 * has it recorded (or in any post-AWAITING_FUNDS state), the hook surfaces
 * `inflightTxHash` so the consumer renders the "Transfer processing" gate
 * instead of the form.
 *
 * Entries are cleared on:
 *   - explicit `clearInflight()` call (consumer signals done — usually on
 *     SUCCESS view).
 *   - BE 404 (the hash was never recorded — likely the on-chain leg never
 *     actually fired; safe to clear so the form re-renders).
 *   - TTL expiry (24h) — defensive against stale storage if the user just
 *     never came back. Bridge offramps that haven't completed in 24h are
 *     either resolved (we'd have had a separate update) or stuck and need
 *     ops intervention regardless.
 */

const STORAGE_KEY = 'peanut.inflightOfframps.v1'
const TTL_MS = 24 * 60 * 60 * 1000 // 24h

type InflightEntry = {
    transferId: string
    txHash: string
    submittedAt: number // Date.now()
}

function readAll(): InflightEntry[] {
    if (typeof window === 'undefined') return []
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.filter(
            (e): e is InflightEntry =>
                e &&
                typeof e === 'object' &&
                typeof e.transferId === 'string' &&
                typeof e.txHash === 'string' &&
                typeof e.submittedAt === 'number'
        )
    } catch {
        return []
    }
}

function writeAll(entries: InflightEntry[]): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
        // Quota exceeded / private mode — non-fatal. Worst case we lose
        // recovery for this flow, which is the pre-hook behavior.
    }
}

export interface UseInflightOfframpRecoveryResult {
    /** The on-chain tx hash for the currently in-flight transfer, if any. */
    inflightTxHash: string | null
    /** True while we're checking localStorage + BE on mount. */
    isRecovering: boolean
    /** Call when the consumer kicks off a new offramp confirm attempt. */
    markSubmitted: (transferId: string, txHash: string) => void
    /** Call from the consumer when the flow reaches a terminal SUCCESS state. */
    clearInflight: (transferId: string) => void
}

export function useInflightOfframpRecovery(): UseInflightOfframpRecoveryResult {
    const [inflightTxHash, setInflightTxHash] = useState<string | null>(null)
    const [isRecovering, setIsRecovering] = useState(true)

    // Recovery on mount: prune expired, then ask the BE about each remaining
    // entry. First confirmed in-flight wins (we only have one form per page).
    useEffect(() => {
        let cancelled = false
        const run = async () => {
            const now = Date.now()
            const entries = readAll()
            const fresh = entries.filter((e) => now - e.submittedAt < TTL_MS)
            if (fresh.length !== entries.length) writeAll(fresh)
            if (fresh.length === 0) {
                if (!cancelled) setIsRecovering(false)
                return
            }
            // Most recent first — restore that one if BE knows about it.
            fresh.sort((a, b) => b.submittedAt - a.submittedAt)
            for (const entry of fresh) {
                const beState = await getOfframpByTxHash(entry.txHash)
                if (cancelled) return
                if (beState) {
                    setInflightTxHash(entry.txHash)
                    setIsRecovering(false)
                    return
                }
                // 404 from BE — that hash was never recorded. The on-chain
                // leg may have failed before /confirm was reached. Drop the
                // entry so the form renders normally on next visit.
                writeAll(readAll().filter((e) => e.transferId !== entry.transferId))
            }
            setIsRecovering(false)
        }
        run().catch((err) => {
            Sentry.captureException(err, { tags: { area: 'inflight-offramp-recovery' } })
            if (!cancelled) setIsRecovering(false)
        })
        return () => {
            cancelled = true
        }
    }, [])

    const markSubmitted = useCallback((transferId: string, txHash: string) => {
        const entries = readAll().filter((e) => e.transferId !== transferId)
        entries.push({ transferId, txHash, submittedAt: Date.now() })
        writeAll(entries)
        setInflightTxHash(txHash)
    }, [])

    const clearInflight = useCallback((transferId: string) => {
        const entries = readAll().filter((e) => e.transferId !== transferId)
        writeAll(entries)
        setInflightTxHash(null)
    }, [])

    return { inflightTxHash, isRecovering, markSubmitted, clearInflight }
}
