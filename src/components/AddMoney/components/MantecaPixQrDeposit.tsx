'use client'

import { type FC, useEffect, useMemo, useState } from 'react'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import NavHeader from '@/components/Global/NavHeader'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { type MantecaDepositResponseData } from '@/types/manteca.types'
import { useMantecaDepositPolling } from '@/components/AddMoney/hooks/useMantecaDepositPolling'
import CyclingLoading from '@/components/Global/Loading/CyclingLoading'
import { useTranslations } from 'next-intl'

const MantecaPixQrDeposit: FC<{
    depositDetails: MantecaDepositResponseData
    currencyAmount?: string
    // Parent owns step navigation — usually setUrlState({ step: 'inputAmount' }).
    onBack: () => void
    // Exits the deposit flow entirely (home). Distinct from onBack: once the
    // deposit has settled there is nothing to go "back" to — reusing onBack here
    // dropped the user on the amount input, i.e. straight into a NEW deposit.
    onDone: () => void
    // Fired once when the deposit settles (parent refreshes balance/history).
    onComplete: () => void
}> = ({ depositDetails, currencyAmount, onBack, onDone, onComplete }) => {
    const t = useTranslations('addMoney')
    const tCommon = useTranslations('common')
    // The dynamic PIX QR (EMVCo copia-e-cola) rides in the ramp-on synthetic's
    // details.depositAddresses.PIX (confirmed against prod 2026-07-02).
    const qr = depositDetails.details.depositAddresses?.PIX?.code
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
            <PageStack>
                <NavHeader title={t('title')} onPrev={onDone} />
                <div className="my-auto flex flex-col items-center gap-4 text-center">
                    <IconBubble icon="check" size="m" color="green" />
                    <h2 className="text-heading-s text-foreground-primary">{t('pix.depositReceived')}</h2>
                    <p className="text-body-s text-foreground-secondary">{t('pix.balanceUpdated')}</p>
                    <Button variant="purple" shadowSize="4" className="w-full" onClick={onDone}>
                        {tCommon('done')}
                    </Button>
                </div>
            </PageStack>
        )
    }

    // Payment detected, settling — show the branded processing screen (same as PIX payments).
    // `processing` means stage >= 2, i.e. the fiat HAS left the user's bank, so this exits
    // like `completed` does: going "back" here would offer the amount input, pre-filled with
    // the amount they just paid, one tap from paying twice. The credit doesn't depend on this
    // screen — the webhook/poller post it server-side.
    if (status === 'processing') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onDone} />
                <div className="my-auto flex flex-col justify-center">
                    <CyclingLoading />
                </div>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <div className="my-auto flex flex-col gap-6">
                <div className="text-center">
                    <p className="text-body-s text-foreground-secondary">{t('pix.payWithPix')}</p>
                    {currencyAmount && <p className="text-heading-s text-foreground-primary">R$ {currencyAmount}</p>}
                </div>

                {!qr ? (
                    <CyclingLoading />
                ) : (
                    <>
                        <QRCodeWrapper url={qr} isBlurred={isExpired} disabled={isExpired} className="max-w-[280px]" />

                        {countdownLabel && (
                            <p className="text-center text-body-s text-foreground-secondary">
                                {t('pix.expiresIn', { time: countdownLabel })}
                            </p>
                        )}

                        {isExpired ? (
                            <div className="flex flex-col gap-3 text-center">
                                <p className="text-body-s text-foreground-secondary">{t('pix.qrExpired')}</p>
                                <Button variant="stroke" className="w-full" onClick={onBack}>
                                    {t('pix.goBack')}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <p className="text-center text-body-s text-foreground-secondary">
                                    {t('pix.scanWithBankApp')}
                                </p>
                                <CopyToClipboard textToCopy={qr} type="button" className="w-full" />
                            </div>
                        )}
                    </>
                )}
            </div>
        </PageStack>
    )
}

export default MantecaPixQrDeposit
