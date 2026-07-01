'use client'

import { type FC, useEffect, useMemo, useState } from 'react'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Icon } from '@/components/Global/Icons/Icon'
import { Button } from '@/components/0_Bruddle/Button'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { useMantecaDepositPolling } from '@/components/AddMoney/hooks/useMantecaDepositPolling'
import CyclingLoading from '@/components/Global/PeanutLoading/CyclingLoading'

const MantecaPixQrDeposit: FC<{
    depositDetails: MantecaDepositResponseData
    currencyAmount?: string
    // Parent owns step navigation — usually setUrlState({ step: 'inputAmount' }).
    onBack: () => void
    // Fired once when the deposit settles (parent refreshes balance/history).
    onComplete: () => void
}> = ({ depositDetails, currencyAmount, onBack, onComplete }) => {
    // The dynamic PIX QR (EMVCo copia-e-cola) rides in the ramp-on synthetic's details.
    const qr = depositDetails.details.qr
    // Poll by the real synthetic id (unchanged polling contract).
    const { status } = useMantecaDepositPolling(depositDetails.id, onComplete)

    // QR expiry countdown. `priceExpireAt` carries a tz offset, so Date parses it
    // directly. We tick once a second and stop once the QR is paid or has lapsed
    // (the effect re-runs when isExpired flips and clears the interval).
    const expiresAtMs = useMemo(
        () => new Date(depositDetails.details.priceExpireAt).getTime(),
        [depositDetails.details.priceExpireAt]
    )
    const [nowMs, setNowMs] = useState(() => Date.now())

    const remainingMs = expiresAtMs - nowMs
    const isExpired = remainingMs <= 0
    const minutes = Math.floor(remainingMs / 60000)
    const seconds = Math.floor((remainingMs % 60000) / 1000)
    const countdownLabel = isExpired ? null : `${minutes}:${String(seconds).padStart(2, '0')}`

    useEffect(() => {
        if (status === 'completed' || status === 'processing' || isExpired) return
        const interval = setInterval(() => setNowMs(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [status, isExpired])

    if (status === 'completed') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Add Money" onPrev={onBack} />
                <div className="my-auto flex flex-col items-center gap-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-1">
                        <Icon name="check" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-n-1">Deposit received!</h2>
                    <p className="text-grey-1">Your balance has been updated.</p>
                    <Button variant="purple" shadowSize="4" className="w-full" onClick={onBack}>
                        Done
                    </Button>
                </div>
            </div>
        )
    }

    // Payment detected, settling — show the branded processing screen (same as PIX payments).
    if (status === 'processing') {
        return (
            <div className="flex min-h-[inherit] flex-col gap-8">
                <NavHeader title="Add Money" onPrev={onBack} />
                <div className="my-auto flex flex-col justify-center">
                    <CyclingLoading />
                </div>
            </div>
        )
    }

    return (
        <div className="flex min-h-[inherit] flex-col gap-8">
            <NavHeader title="Add Money" onPrev={onBack} />
            <div className="my-auto flex flex-col gap-6">
                <div className="text-center">
                    <p className="text-sm text-grey-1">Pay with PIX</p>
                    {currencyAmount && <p className="text-2xl font-bold text-n-1">R$ {currencyAmount}</p>}
                </div>

                {!qr ? (
                    <CyclingLoading />
                ) : (
                    <>
                        <QRCodeWrapper url={qr} isBlurred={isExpired} disabled={isExpired} className="max-w-[280px]" />

                        {countdownLabel && (
                            <p className="text-center text-sm text-grey-1">Expires in {countdownLabel}</p>
                        )}

                        {isExpired ? (
                            <div className="flex flex-col gap-3 text-center">
                                <p className="text-sm text-grey-1">This QR code has expired.</p>
                                <Button variant="stroke" className="w-full" onClick={onBack}>
                                    Go back
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <p className="text-center text-sm text-grey-1">
                                    Scan with your bank app, or copy the PIX code.
                                </p>
                                <CopyToClipboard textToCopy={qr} type="button" className="w-full" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}

export default MantecaPixQrDeposit
