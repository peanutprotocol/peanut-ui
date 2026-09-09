'use client'

import { useCallback, useEffect, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { Notification } from '@/components/0_Bruddle/Notification'
import { useTranslations } from 'next-intl'
import type { Hex } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import NavHeader from '@/components/Global/NavHeader'
import Loading from '@/components/Global/Loading'
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
    const t = useTranslations('card.recovery')
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

    if (!preview && !error) return <Loading variant="mascot" />

    return (
        <PageStack>
            <NavHeader title={t('navTitle')} onPrev={onBack} />
            <PageStack.Center>
                {error && <Notification priority="error">{error}</Notification>}

                {step === 'done' && txHash ? (
                    <Card className="flex flex-col gap-3 p-6">
                        <h2 className="text-heading-card">{t('doneTitle')}</h2>
                        <p className="text-body-s text-foreground-secondary">
                            {t('doneBody', { amount: `$${formatCents(recoveredCents ?? preview!.amountCents)}` })}
                        </p>
                        <LinkButton
                            href={`${getExplorerUrl(String(PEANUT_WALLET_CHAIN.id)) ?? ''}/tx/${txHash}`}
                            external
                            className="self-start"
                        >
                            {t('viewTransaction')}
                        </LinkButton>
                    </Card>
                ) : (
                    preview && (
                        <>
                            <Card className="flex flex-col gap-3 p-6">
                                <h2 className="text-heading-card">
                                    {preview.hasRecoverableCard ? t('title') : t('noCardOnFile')}
                                </h2>
                                <p className="text-body-s text-foreground-secondary">{t('description')}</p>

                                <Row label={t('recoverable')} value={`$${formatCents(preview.amountCents)} USDC`} />
                                <Row label={t('destination')} value={shorten(preview.recipient)} />
                                {BigInt(preview.dustWei) > 0n && (
                                    <Row label={t('dust')} value={`${preview.dustWei} wei (< $0.01)`} />
                                )}
                                <Row
                                    label={t('autoBalance')}
                                    value={preview.autoBalanceEnabled ? t('autoBalanceOn') : t('autoBalanceOff')}
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
                                    ? t('signWithPasskey')
                                    : step === 'submitting'
                                      ? t('submitting')
                                      : t('cta')}
                            </Button>
                        </>
                    )
                )}
            </PageStack.Center>
        </PageStack>
    )
}

// A decimal-integer string is the only thing BigInt() accepts without throwing.
const isIntegerString = (value: unknown): value is string => typeof value === 'string' && /^-?\d+$/.test(value)

function isRecoverablePreview(data: RecoverFundsPreviewResponse | undefined | null): boolean {
    return (
        !!data &&
        isIntegerString(data.amountCents) &&
        isIntegerString(data.dustWei) &&
        typeof data.recipient === 'string'
    )
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-body-s text-foreground-secondary">{label}</span>
            <span className="text-body-s text-foreground-primary">{value}</span>
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
