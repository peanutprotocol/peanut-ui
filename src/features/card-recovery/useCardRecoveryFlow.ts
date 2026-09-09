'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Hex } from 'viem'
import { useKernelClient } from '@/context/kernelClient.context'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { rainApi, type RecoverFundsPreviewResponse } from '@/services/rain'
import { isRecoverablePreview } from './utils'

export type CardRecoveryStep = 'preview' | 'confirm' | 'signing' | 'submitting' | 'done'

/**
 * flow hook for the card collateral recovery page — owns the step machine
 * (preview → confirm → kernel-sign EIP-712 → submit) so the page stays dumb.
 */
export function useCardRecoveryFlow() {
    const t = useTranslations('card.recovery')
    const { getClientForChain } = useKernelClient()

    const [step, setStep] = useState<CardRecoveryStep>('preview')
    const [preview, setPreview] = useState<RecoverFundsPreviewResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [txHash, setTxHash] = useState<Hex | null>(null)
    // The amount actually prepared + signed + submitted. The mount-time `preview`
    // can be stale by the time the user confirms (collateral can change), so the
    // completion screen must report what was really recovered, not the preview.
    const [recoveredCents, setRecoveredCents] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            try {
                const data = await rainApi.getRecoverFundsPreview()
                // amountCents/dustWei go straight into BigInt() during render, which
                // THROWS on a missing or non-integer value — a partial 200 used to
                // take the whole route down with a client-side exception instead of
                // landing in the error banner two lines below. Validate here so a
                // bad payload is a message, not a white screen.
                if (!isRecoverablePreview(data)) throw new Error(t('previewFailed'))
                if (!cancelled) setPreview(data)
            } catch (e) {
                if (!cancelled) setError((e as Error).message || t('previewFailed'))
            }
        })()
        return () => {
            cancelled = true
        }
    }, [t])

    const handleRecover = useCallback(async () => {
        setError(null)
        setStep('signing')
        try {
            // Prepare locks in the amount + recipient server-side. Even if the
            // page were tampered with at runtime, the backend signs over the
            // values it computed itself.
            const prep = await rainApi.prepareRecoverFunds()
            // Lock in the real prepared amount for the completion screen.
            setRecoveredCents(prep.amountCents)

            const chainIdStr = String(PEANUT_WALLET_CHAIN.id)
            const chainIdNum = Number(prep.chainId)
            const kernelClient = getClientForChain(chainIdStr)

            const adminSignature = (await kernelClient.account!.signTypedData(
                buildRainWithdrawTypedData(prep, chainIdNum)
            )) as Hex

            setStep('submitting')
            const { txHash: hash } = await rainApi.submitWithdrawal({
                preparationId: prep.preparationId,
                amount: prep.amount,
                recipientAddress: prep.recipientAddress,
                directTransfer: prep.directTransfer,
                adminSalt: prep.adminSalt,
                adminNonce: prep.adminNonce,
                adminSignature,
                executorSignature: prep.executorSignature,
                executorSalt: prep.executorSalt,
                expiresAt: prep.expiresAt,
            })
            setTxHash(hash as Hex)
            setStep('done')
        } catch (e) {
            setError((e as Error).message || t('failed'))
            setStep('preview')
        }
    }, [getClientForChain, t])

    return {
        step,
        preview,
        error,
        txHash,
        recoveredCents,
        handleRecover,
    }
}
