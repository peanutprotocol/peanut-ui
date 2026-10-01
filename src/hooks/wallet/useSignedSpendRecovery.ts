'use client'

import { useCallback, useEffect, useRef } from 'react'
import { rainApi, RainCooldownError } from '@/services/rain'
import {
    awaitRainCooldownWithinLock,
    getSpendArtifactMeta,
    isRainControllerChanged,
    isStructuredBroadcastFailure,
    SpendRecoveryAbortedError,
    toQuoteReview,
} from './signSpendRetry'
import { isUserCancellation, sameAddress } from './spendPreflight'
import type { SignedSpendArtifact } from './useSignSpendBundle'

/**
 * Backend contract that makes a returned USER_OP_REVERTED / USER_OP_REJECTED
 * safe to replace: both Manteca routes force broadcast-first for a
 * `rainPreparationId`, so such a failure proves zero provider orders were
 * created and the payment lock is free again.
 */
const BROADCAST_FIRST_REVERT = 'broadcast-first-revert-v1'

/**
 * Decides whether a failed backend submission may be replaced by a freshly
 * prepared + signed artifact for the SAME payment, and produces it. Only two
 * classes of failure qualify:
 *
 *  - `RAIN_CONTROLLER_CHANGED` — raised by prepare/verify only, i.e.
 *    structurally before any order, claim or broadcast.
 *  - a STRUCTURED `USER_OP_REVERTED` / `USER_OP_REJECTED` on a mixed artifact
 *    whose prep carried the broadcast-first capability, AND the controller has
 *    actually moved since that prep (someone else's refresh makes `changed`
 *    useless, so compare addresses).
 *
 * Everything else — unknown, timeout, pending, message-only failures,
 * smart-only, legacy mixed — returns null and the original outcome stands.
 */
export type RecoverSignedSpend = (
    failure: unknown,
    artifact: SignedSpendArtifact,
    resign: () => Promise<SignedSpendArtifact>,
    opts?: {
        /** The lock's deadline on this device's clock, in ms (`receiveLock`).
         *  A cooldown that cannot be waited out inside it hands back to quote
         *  review instead. */
        lockExpiresAt?: number
    }
) => Promise<SignedSpendArtifact | null>

export const useSignedSpendRecovery = (): RecoverSignedSpend => {
    const unmountedRef = useRef(false)
    useEffect(() => {
        unmountedRef.current = false
        return () => {
            unmountedRef.current = true
        }
    }, [])

    return useCallback(async (failure, artifact, resign, opts) => {
        /*
         * Every await below can resolve after the user has left: the recovery
         * must not start — or hand back — anything the flow would then submit.
         * This only gates work that has NOT been sent; an outcome already in
         * flight keeps its own reconciliation.
         */
        const abortIfGone = () => {
            if (unmountedRef.current) throw new SpendRecoveryAbortedError(failure)
        }
        abortIfGone()

        const meta = getSpendArtifactMeta(artifact)
        if (!meta) return null

        if (!isRainControllerChanged(failure)) {
            if (!isStructuredBroadcastFailure(failure)) return null
            if (artifact.strategy !== 'mixed' || meta.mixedSpendContract !== BROADCAST_FIRST_REVERT) return null
            const current = await rainApi.refreshControllerAddress().catch(() => null)
            abortIfGone()
            if (!current || sameAddress(current.coordinatorAddress, meta.coordinatorAddress)) return null
        }

        // No cancel of the superseded prep: both branches are failures the
        // backend already recorded on that intent, so the cancel would be
        // refused and changes nothing on Rain's side either way.
        const attempt = async (): Promise<SignedSpendArtifact> => {
            abortIfGone()
            let replacement: SignedSpendArtifact
            try {
                replacement = await resign()
            } catch (error) {
                if (isUserCancellation(error)) throw new SpendRecoveryAbortedError(failure)
                throw error
            }
            // Signing (prepare + grant + passkey) can outlive the screen; a
            // replacement handed back now would be submitted by the caller.
            abortIfGone()
            return replacement
        }

        try {
            return await attempt()
        } catch (error) {
            if (!(error instanceof RainCooldownError)) throw error
            // Rain is cooling down the fresh signature. The shared policy decides
            // whether waiting still fits this payment's quote — if it does not,
            // the call site has to re-quote BEFORE anything is signed again.
            const verdict = await awaitRainCooldownWithinLock({
                retryAfterSec: error.retryAfterSec,
                lockExpiresAt: opts?.lockExpiresAt,
                cancelled: () => unmountedRef.current,
            })
            if (verdict === 'exceeds-lock') throw toQuoteReview(error)
            if (verdict === 'cancelled') throw new SpendRecoveryAbortedError(error)
            try {
                return await attempt()
            } catch (again) {
                if (again instanceof RainCooldownError) throw toQuoteReview(again)
                throw again
            }
        }
    }, [])
}
