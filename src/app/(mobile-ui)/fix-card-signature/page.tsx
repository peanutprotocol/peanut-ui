'use client'

/**
 * Hidden support page: /fix-card-signature
 *
 * Guided repair for accounts whose card auto-funding approval can never
 * validate (nonce-bricked or undeployed kernel — see useCardSignatureRepair).
 * Not linked from anywhere; support DMs the URL to affected users. Two passkey
 * taps: repair the wallet state, then re-grant auto-funding (the backend
 * kicks off a funding run the moment the new approval is stored).
 */

import { useEffect, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useCardSignatureRepair } from '@/hooks/wallet/useCardSignatureRepair'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'

export default function FixCardSignaturePage() {
    const t = useTranslations('card')
    const { address } = useZeroDev()
    const { overview, isLoading: isOverviewLoading } = useRainCardOverview()
    const { diagnosis, isDiagnosing, isRepairing, error, diagnose, repair } = useCardSignatureRepair()
    const { grant, isGranting } = useGrantSessionKey()
    const [grantDone, setGrantDone] = useState(false)
    const [grantErrorMessage, setGrantErrorMessage] = useState<string | null>(null)

    const card = findActiveCard(overview)

    // Keyed on address: the zerodev address hydrates asynchronously after the
    // layout unblocks, so a mount-only effect would diagnose before it exists
    // and never retry — dead page on a cold load from a support DM.
    useEffect(() => {
        if (address) void diagnose()
    }, [address, diagnose])

    const needsRepair = diagnosis !== null && diagnosis.state !== 'healthy'
    const busy = isDiagnosing || isRepairing || isGranting

    const handleRepair = async () => {
        setGrantErrorMessage(null)
        await repair()
    }

    const handleGrant = async () => {
        setGrantErrorMessage(null)
        const result = await grant()
        if (result.ok) {
            setGrantDone(true)
        } else if (result.error.kind !== 'user-cancelled') {
            setGrantErrorMessage(
                result.error.kind === 'no-card' ? t('fixSignature.noActiveCard') : t('fixSignature.regrantFailed')
            )
        }
    }

    return (
        <PageStack>
            <NavHeader title={t('fixSignature.navTitle')} />
            <PageStack.Center>
                <p className="text-body-s text-foreground-secondary">{t('fixSignature.intro')}</p>

                {(isDiagnosing || (!address && !diagnosis)) && (
                    <p className="text-body-s">{t('fixSignature.checkingWallet')}</p>
                )}

                {!isDiagnosing && !diagnosis && error && (
                    <Button variant="stroke" className="w-full" onClick={() => void diagnose()}>
                        {t('fixSignature.checkAgain')}
                    </Button>
                )}

                {diagnosis && (
                    <Card className="flex flex-col gap-3 p-4">
                        <div className="flex items-center justify-between">
                            <span className="font-bold">{t('fixSignature.step1')}</span>
                            {needsRepair ? (
                                isRepairing ? (
                                    <Loading />
                                ) : (
                                    <span className="flex items-center gap-2 text-body-s">
                                        <IconBubble icon="alert" size="xs" color="yellow" />
                                        {t('fixSignature.needed')}
                                    </span>
                                )
                            ) : (
                                <IconBubble icon="check" size="xs" color="green" />
                            )}
                        </div>
                        {needsRepair && (
                            <>
                                <p className="text-body-s text-foreground-secondary">
                                    {diagnosis.state === 'nonce-bricked'
                                        ? t('fixSignature.nonceBricked')
                                        : t('fixSignature.undeployed')}
                                </p>
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    className="w-full"
                                    onClick={handleRepair}
                                    disabled={busy}
                                >
                                    {isRepairing ? t('fixSignature.repairing') : t('fixSignature.repairNow')}
                                </Button>
                            </>
                        )}
                    </Card>
                )}

                {diagnosis?.state === 'healthy' && (
                    <Card className="flex flex-col gap-3 p-4">
                        <div className="flex items-center justify-between">
                            <span className="font-bold">{t('fixSignature.step2')}</span>
                            {grantDone ? (
                                <IconBubble icon="check" size="xs" color="green" />
                            ) : isGranting ? (
                                <Loading />
                            ) : null}
                        </div>
                        {grantDone ? (
                            <p className="text-body-s text-foreground-secondary">{t('fixSignature.allSet')}</p>
                        ) : (
                            <>
                                <p className="text-body-s text-foreground-secondary">
                                    {t('fixSignature.oneMoreConfirmation')}
                                </p>
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    className="w-full"
                                    onClick={handleGrant}
                                    disabled={busy || isOverviewLoading || !card}
                                >
                                    {isGranting
                                        ? t('fixSignature.waitingForConfirmation')
                                        : isOverviewLoading
                                          ? t('fixSignature.loadingCard')
                                          : t('fixSignature.reEnableFunding')}
                                </Button>
                                {!isOverviewLoading && !card && (
                                    <p className="text-body-s text-foreground-secondary">
                                        {t('fixSignature.noActiveCard')}
                                    </p>
                                )}
                            </>
                        )}
                    </Card>
                )}

                {(error || grantErrorMessage) && (
                    <p className="text-body-s text-foreground-error">{error ?? grantErrorMessage}</p>
                )}

                {diagnosis && diagnosis.state !== 'undeployed' && (
                    <p className="text-body-xs text-foreground-secondary">
                        {t('fixSignature.diagnostics', {
                            nonce: diagnosis.currentNonce,
                            floor: diagnosis.validNonceFrom,
                        })}
                    </p>
                )}
            </PageStack.Center>
        </PageStack>
    )
}
