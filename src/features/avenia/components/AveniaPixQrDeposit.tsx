'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { useAuth } from '@/context/authContext'
import { countdownLabel } from '@/features/avenia/avenia.utils'
import { useAveniaDepositStatus } from '@/features/avenia/hooks/useAveniaDepositStatus'
import type { AveniaDeposit } from '@/services/avenia'
import { formatBankAmount } from '@/utils/currency'

/**
 * The dynamic Pix code of an Avenia deposit: the amount in reais, the time the
 * code has left, and who the payer must be (an account under the user's own
 * CPF: Avenia returns any other Pix).
 */
export function AveniaPixQrDeposit({
    deposit,
    onBack,
    onDone,
    onComplete,
}: {
    deposit: AveniaDeposit
    onBack: () => void
    /** Leaves the flow: the deposit is paid, or there is nothing left to pay. */
    onDone: () => void
    onComplete: () => void
}) {
    const t = useTranslations('addMoney')
    const tAvenia = useTranslations('avenia.deposit')
    const tCommon = useTranslations('common')
    const { user } = useAuth()
    const { phase } = useAveniaDepositStatus(deposit.intentId, onComplete)

    const expiresAtMs = useMemo(() => (deposit.expiresAt ? Date.parse(deposit.expiresAt) : null), [deposit.expiresAt])
    const [nowMs, setNowMs] = useState(() => Date.now())
    const remainingMs = expiresAtMs === null ? null : expiresAtMs - nowMs
    const isExpired = remainingMs !== null && remainingMs <= 0
    const timeLeft = remainingMs === null ? null : countdownLabel(remainingMs)

    // tick once a second until the code is paid or has lapsed
    useEffect(() => {
        if (phase !== 'pending' || isExpired || expiresAtMs === null) return
        const interval = setInterval(() => setNowMs(Date.now()), 1000)
        return () => clearInterval(interval)
    }, [phase, isExpired, expiresAtMs])

    if (phase === 'completed') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onDone} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="check" size="l" color="green" />
                    <TitleBlock align="center" title={t('pix.depositReceived')} description={t('pix.balanceUpdated')} />
                    <Button variant="primary" className="w-full" onClick={onDone}>
                        {tCommon('done')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    // The Pix has left the user's bank: back would offer the amount again, one tap from paying twice.
    if (phase === 'processing') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onDone} />
                <ProcessingScreen title={t('processingDepositTitle')} description={t('processingDepositBody')} />
            </PageStack>
        )
    }

    if (phase === 'returned') {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onDone} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="alert" size="l" color="red" />
                    <TitleBlock
                        align="center"
                        title={tAvenia('returnedTitle')}
                        description={tAvenia('returnedBody', { cpf: deposit.payerCpfMasked })}
                    />
                    <Button variant="primary" className="w-full" onClick={onBack}>
                        {t('pix.goBack')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <PageStack.Center>
                <div className="text-center">
                    <p className="text-heading-s text-foreground-primary">
                        {formatBankAmount(deposit.amountBrl, 'BRL')}
                    </p>
                    {timeLeft && (
                        <p className="text-body-s text-foreground-secondary">
                            {t('pix.expiresIn', { time: timeLeft })}
                        </p>
                    )}
                </div>

                <QRCodeWrapper
                    url={deposit.brCode}
                    isBlurred={isExpired}
                    disabled={isExpired}
                    className="mx-auto max-w-[280px]"
                />

                {isExpired ? (
                    <div className="flex flex-col gap-3 text-center">
                        <p className="text-body-s text-foreground-secondary">{t('pix.qrExpired')}</p>
                        <Button variant="primary" className="w-full" onClick={onBack}>
                            {t('pix.goBack')}
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        <p className="text-center text-body-s text-foreground-secondary">{t('pix.scanWithBankApp')}</p>
                        <CopyToClipboard textToCopy={deposit.brCode} type="button" className="w-full" />
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {user?.user?.fullName && <AvatarWithBadge name={user.user.fullName} size="xs" />}
                    <p className="text-body-s text-foreground-secondary">
                        {tAvenia('ownCpf', { cpf: deposit.payerCpfMasked })}
                    </p>
                </div>

                <ProviderFinePrint providerId="avenia-br" />
            </PageStack.Center>
        </PageStack>
    )
}
