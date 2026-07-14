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
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import NavHeader from '@/components/Global/NavHeader'
import { findActiveCard } from '@/components/Card/cardState.utils'
import { useRainCardOverview } from '@/hooks/useRainCardOverview'
import { useZeroDev } from '@/hooks/useZeroDev'
import { useCardSignatureRepair } from '@/hooks/wallet/useCardSignatureRepair'
import { useGrantSessionKey } from '@/hooks/wallet/useGrantSessionKey'

export default function FixCardSignaturePage() {
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
                result.error.kind === 'no-card'
                    ? 'No active card found on this account — please contact support.'
                    : 'Re-enabling did not complete — please try again or contact support.'
            )
        }
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Fix card signature" />
            <div className="my-auto flex flex-col gap-6">
                <p className="text-sm text-grey-1">
                    This tool repairs a wallet state issue that stops your card from funding itself automatically. It
                    takes up to two quick passkey confirmations.
                </p>

                {(isDiagnosing || (!address && !diagnosis)) && <p className="text-sm">Checking your wallet…</p>}

                {!isDiagnosing && !diagnosis && error && (
                    <Button variant="stroke" className="w-full" onClick={() => void diagnose()}>
                        Check again
                    </Button>
                )}

                {diagnosis && (
                    <Card className="flex flex-col gap-3 p-4">
                        <div className="flex items-center justify-between">
                            <span className="font-bold">1. Repair wallet state</span>
                            <span className="text-sm">{needsRepair ? (isRepairing ? '⏳' : '⚠️ needed') : '✅'}</span>
                        </div>
                        {needsRepair && (
                            <>
                                <p className="text-sm text-grey-1">
                                    {diagnosis.state === 'nonce-bricked'
                                        ? 'Your wallet is blocking new card permissions after an earlier security upgrade. One confirmation clears it.'
                                        : 'Your wallet needs a one-time on-chain activation before card permissions can work.'}
                                </p>
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    className="w-full"
                                    onClick={handleRepair}
                                    disabled={busy}
                                >
                                    {isRepairing ? 'Repairing…' : 'Repair now'}
                                </Button>
                            </>
                        )}
                    </Card>
                )}

                {diagnosis?.state === 'healthy' && (
                    <Card className="flex flex-col gap-3 p-4">
                        <div className="flex items-center justify-between">
                            <span className="font-bold">2. Re-enable automatic funding</span>
                            <span className="text-sm">{grantDone ? '✅' : isGranting ? '⏳' : ''}</span>
                        </div>
                        {grantDone ? (
                            <p className="text-sm text-grey-1">
                                All set! Automatic funding is back on and a funding run has been started — your card
                                balance should update within a few minutes.
                            </p>
                        ) : (
                            <>
                                <p className="text-sm text-grey-1">
                                    One more confirmation re-enables automatic card funding with a fresh permission.
                                </p>
                                <Button
                                    variant="purple"
                                    shadowSize="4"
                                    className="w-full"
                                    onClick={handleGrant}
                                    disabled={busy || isOverviewLoading || !card}
                                >
                                    {isGranting
                                        ? 'Waiting for confirmation…'
                                        : isOverviewLoading
                                          ? 'Loading your card…'
                                          : 'Re-enable funding'}
                                </Button>
                                {!isOverviewLoading && !card && (
                                    <p className="text-sm text-grey-1">
                                        No active card found on this account — please contact support.
                                    </p>
                                )}
                            </>
                        )}
                    </Card>
                )}

                {(error || grantErrorMessage) && <p className="text-sm text-error">{error ?? grantErrorMessage}</p>}

                {diagnosis && diagnosis.state !== 'undeployed' && (
                    <p className="text-xs text-grey-1">
                        Diagnostics: nonce {diagnosis.currentNonce} / floor {diagnosis.validNonceFrom}
                    </p>
                )}
            </div>
        </div>
    )
}
