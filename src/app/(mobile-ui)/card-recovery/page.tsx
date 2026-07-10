'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Hex } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import ErrorAlert from '@/components/Global/ErrorAlert'
import NavHeader from '@/components/Global/NavHeader'
import PeanutLoading from '@/components/Global/PeanutLoading'
import { useKernelClient } from '@/context/kernelClient.context'
import { useSafeBack } from '@/hooks/useSafeBack'
import { buildRainWithdrawTypedData } from '@/utils/rainWithdraw.utils'
import { PEANUT_WALLET_CHAIN } from '@/constants/zerodev.consts'
import { rainApi, type RecoverFundsPreviewResponse } from '@/services/rain'
import { getExplorerUrl } from '@/utils/general.utils'

type Step = 'preview' | 'confirm' | 'signing' | 'submitting' | 'done'

/**
 * Card collateral recovery flow.
 *
 * For the deleted-Rain-user case: a user's collateral USDC is sitting on-chain
 * in the Rain coordinator's proxy, but Rain's balance endpoint won't return it
 * because their Rain user record was deleted. The normal /withdraw flow can't
 * see the balance, so we have a dedicated recovery endpoint pair on the
 * backend that reads the on-chain balance directly and asks Rain for a
 * signature for that exact amount, paid to the user's own smart wallet.
 *
 * This page wires that flow: preview → confirm → kernel-sign EIP-712 →
 * submit. The destination address is decided by the backend and shown here
 * for transparency; the FE cannot influence it.
 *
 * Not linked from anywhere in the main app — accessed by URL only. It's safe
 * to share the URL with a user who needs to recover funds: the JWT cookie is
 * the only auth, the recipient is server-locked, and the signing step still
 * requires the user's passkey.
 */
export default function CardRecoveryPage() {
    const onBack = useSafeBack('/home')
    const { getClientForChain } = useKernelClient()

    const [step, setStep] = useState<Step>('preview')
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
                if (!cancelled) setPreview(data)
            } catch (e) {
                if (!cancelled) setError((e as Error).message || 'Could not load recovery preview')
            }
        })()
        return () => {
            cancelled = true
        }
    }, [])

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
            setError((e as Error).message || 'Recovery failed — please try again')
            setStep('preview')
        }
    }, [getClientForChain])

    if (!preview && !error) return <PeanutLoading />

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Recover card funds" onPrev={onBack} />
            <div className="my-auto flex flex-col gap-6">
                {error && <ErrorAlert description={error} />}

                {step === 'done' && txHash ? (
                    <Card className="flex flex-col gap-3 p-6">
                        <h2 className="text-h7 font-bold">Funds sent to your wallet.</h2>
                        <p className="text-sm text-grey-1">
                            ${formatCents(recoveredCents ?? preview!.amountCents)} USDC has been returned to your peanut
                            wallet.
                        </p>
                        <a
                            className="text-black underline"
                            target="_blank"
                            rel="noreferrer"
                            href={`${getExplorerUrl(String(PEANUT_WALLET_CHAIN.id)) ?? ''}/tx/${txHash}`}
                        >
                            View transaction
                        </a>
                    </Card>
                ) : (
                    preview && (
                        <>
                            <Card className="flex flex-col gap-3 p-6">
                                <h2 className="text-h7 font-bold">
                                    {preview.hasRecoverableCard ? 'Recover your card collateral' : 'No card on file'}
                                </h2>
                                <p className="text-sm text-grey-1">
                                    This pulls every USDC currently held in your card collateral contract back to your
                                    peanut wallet. Auto-balance is turned off as part of recovery so the rebalancer
                                    can't top up between now and the transfer.
                                </p>

                                <Row label="Recoverable" value={`$${formatCents(preview.amountCents)} USDC`} />
                                <Row label="Destination" value={shorten(preview.recipient)} />
                                {BigInt(preview.dustWei) > 0n && (
                                    <Row label="Dust left in contract" value={`${preview.dustWei} wei (< $0.01)`} />
                                )}
                                <Row
                                    label="Auto-balance"
                                    value={preview.autoBalanceEnabled ? 'on — will be turned off' : 'off'}
                                />
                            </Card>

                            <Button
                                variant="purple"
                                shadowSize="4"
                                className="w-full"
                                disabled={
                                    step === 'signing' ||
                                    step === 'submitting' ||
                                    BigInt(preview.amountCents) <= 0n ||
                                    !preview.hasRecoverableCard
                                }
                                loading={step === 'signing' || step === 'submitting'}
                                onClick={handleRecover}
                            >
                                {step === 'signing'
                                    ? 'Sign with passkey…'
                                    : step === 'submitting'
                                      ? 'Submitting…'
                                      : 'Recover funds'}
                            </Button>
                        </>
                    )
                )}
            </div>
        </div>
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm text-grey-1">{label}</span>
            <span className="text-sm font-medium text-n-1">{value}</span>
        </div>
    )
}

// Render Rain cents (2 dp) as a fixed-precision USD amount with thousand
// separators. Cents are bigint-string from the wire — never Number() them
// directly; > 2^53 risks lossy display on whales.
function formatCents(centsStr: string): string {
    const cents = BigInt(centsStr)
    const dollars = cents / 100n
    const remainder = (cents % 100n).toString().padStart(2, '0')
    return `${dollars.toLocaleString('en-US')}.${remainder}`
}

function shorten(addr: string): string {
    if (addr.length <= 12) return addr
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
