'use client'

import { useCallback, useEffect, useRef } from 'react'
import type { Address } from 'viem'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { useKernelClient } from '@/context/kernelClient.context'
import { useSignUserOp } from './useSignUserOp'
import { buildUsdcTransferCall, type PreparedSmartSpend } from './smartSpendPreparation'

export interface SmartSpendPreparationInput {
    enabled: boolean
    /** The wallet that would sign. Part of the candidate's identity. */
    accountAddress: Address | null | undefined
    requiredUsdcAmount: bigint | null
    recipient: Address | null
    /** Final, locked payment code. Open-amount QRs have none until Pay. */
    lockCode: string | null
    /** That lock's deadline on this device's clock, in ms (receiveLock). Unknown expiry means no candidate. */
    lockExpiresAt: number | null
}

interface Candidate {
    key: string
    /** Set by effect cleanup; cleared again when the same key re-runs
     *  (StrictMode replay, same-key re-render). A cancelled candidate that
     *  settles is dropped. */
    cancelled: boolean
    result: PreparedSmartSpend | null
}

/**
 * Builds the unsigned smart-only UserOp for a locked payment while the user is
 * still looking at the amount, so Pay only has to re-check nonce/sponsorship
 * and sign. One in-memory candidate at a time, keyed on account, chain,
 * recipient, amount and lock; any change to those (or leaving the screen)
 * drops it and a stale async result is discarded. Preparation never prompts
 * a passkey and never touches Rain or Manteca — see `useSignUserOp.prepareCallsUserOp`.
 *
 * Best-effort by design: a failed or missing candidate just means Pay takes
 * the full path it always did.
 */
export function useSmartSpendPreparation(input: SmartSpendPreparationInput) {
    const { enabled, accountAddress, requiredUsdcAmount, recipient, lockCode, lockExpiresAt } = input
    const { ensureClientForChain } = useKernelClient()
    const { prepareCallsUserOp } = useSignUserOp()
    const chainId = PEANUT_WALLET_CHAIN.id.toString()

    const candidateRef = useRef<Candidate | null>(null)
    const generationRef = useRef(0)

    const lockExpiresAtMs = lockExpiresAt ?? Number.NaN
    const key =
        enabled &&
        accountAddress &&
        requiredUsdcAmount !== null &&
        recipient &&
        lockCode &&
        !Number.isNaN(lockExpiresAtMs)
            ? [
                  chainId,
                  accountAddress.toLowerCase(),
                  recipient.toLowerCase(),
                  requiredUsdcAmount.toString(),
                  lockCode,
                  lockExpiresAtMs,
              ].join('|')
            : null

    useEffect(() => {
        if (!key || !recipient || requiredUsdcAmount === null || !lockCode) {
            candidateRef.current = null
            generationRef.current += 1
            return
        }
        if (!(Date.now() < lockExpiresAtMs)) return

        const current = candidateRef.current
        if (current && current.key === key) {
            // Same identity as the candidate in flight or already built: adopt
            // it instead of preparing again.
            current.cancelled = false
            return () => {
                current.cancelled = true
            }
        }

        const generation = ++generationRef.current
        const candidate: Candidate = { key, cancelled: false, result: null }
        candidateRef.current = candidate
        void (async () => {
            try {
                await ensureClientForChain(chainId)
                const prepared = await prepareCallsUserOp(
                    [buildUsdcTransferCall(recipient, requiredUsdcAmount)],
                    chainId
                )
                if (candidate.cancelled || generationRef.current !== generation) return
                candidate.result = { ...prepared, lockCode, lockExpiresAtMs }
            } catch {
                // Not an error for the user: Pay prepares for itself.
            }
        })()
        return () => {
            candidate.cancelled = true
        }
        // `key` already encodes every other input; listing them too would only
        // re-run the effect on reference churn of the same values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, ensureClientForChain, prepareCallsUserOp])

    /**
     * Hands the candidate to Pay exactly once. Whatever Pay does with it
     * (sign it, or discard it for a rebuilt op) its nonce may now be spent, so
     * a second Pay on this lock must prepare afresh.
     */
    const takePreparedSmartSpend = useCallback((): PreparedSmartSpend | null => {
        const candidate = candidateRef.current
        if (!candidate?.result) return null
        const result = candidate.result
        candidate.result = null
        return result
    }, [])

    return { takePreparedSmartSpend }
}
