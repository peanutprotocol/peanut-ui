'use client'

import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
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
import { useAveniaDepositStatus } from '@/features/avenia/hooks/useAveniaDepositStatus'
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown'
import type { AveniaDeposit } from '@/services/avenia'
import { formatBankAmount } from '@/utils/currency'

/**
 * The dynamic Pix code of an Avenia deposit (`?intentId=`): the amount in
 * reais, the time the code has left, and who the payer must be (an account
 * under the user's own CPF: Avenia returns any other Pix). The deposit's
 * status moves the screen on, also after a reload, when the code itself is
 * gone with the screen's memory.
 */
export function AveniaPixQrDeposit({
    intentId,
    deposit,
    blockedBankNames,
    onBack,
    onDone,
    onComplete,
}: {
    intentId: string
    /** POST /avenia/deposit's answer; undefined after a reload. */
    deposit: AveniaDeposit | undefined
    /** Banks whose Pix Avenia sends back (GET /avenia/deposit/eligibility). */
    blockedBankNames: string[]
    onBack: () => void
    /** Leaves the flow: the deposit is paid, or there is nothing left to pay. */
    onDone: () => void
    onComplete: () => void
}) {
    const t = useTranslations('addMoney')
    const tAvenia = useTranslations('avenia.deposit')
    const tCommon = useTranslations('common')
    const format = useFormatter()
    const { user } = useAuth()
    const { phase, expiresAt: statusExpiresAt } = useAveniaDepositStatus(intentId, onComplete)

    const expiresAt = deposit?.expiresAt ?? statusExpiresAt
    const expiresAtMs = useMemo(() => (expiresAt ? Date.parse(expiresAt) : null), [expiresAt])
    const countdown = useExpiryCountdown(expiresAtMs, phase === 'pending')
    const isExpired = phase === 'expired' || countdown.isExpired

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
                    <TitleBlock align="center" title={tAvenia('returnedTitle')} description={tAvenia('returnedBody')} />
                    <Button variant="primary" className="w-full" onClick={onBack}>
                        {t('pix.goBack')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    // after a reload, while the code can still be paid: title only, the status moves the screen on
    if (!deposit && !isExpired) {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <ProcessingScreen title={t('processingDepositTitle')} />
            </PageStack>
        )
    }

    return (
        <PageStack>
            <NavHeader title={t('title')} onPrev={onBack} />
            <PageStack.Center>
                {deposit && (
                    <>
                        <div className="text-center">
                            <p className="text-heading-s text-foreground-primary">
                                {formatBankAmount(deposit.amountBrl, 'BRL')}
                            </p>
                            {/* Avenia's fees are already out of the quote: this is what the balance receives */}
                            <p className="text-body-s text-foreground-secondary">
                                {tAvenia('youGet', { amount: formatBankAmount(deposit.usdcAmount, 'USD') })}
                            </p>
                            {countdown.timeLeft && (
                                <p className="text-body-s text-foreground-secondary">
                                    {t('pix.expiresIn', { time: countdown.timeLeft })}
                                </p>
                            )}
                        </div>

                        <QRCodeWrapper
                            url={deposit.brCode}
                            isBlurred={isExpired}
                            disabled={isExpired}
                            className="mx-auto max-w-[280px]"
                        />
                    </>
                )}

                {isExpired || !deposit ? (
                    <div className="flex flex-col gap-3 text-center">
                        <p className="text-body-s text-foreground-secondary">{t('pix.qrExpired')}</p>
                        <Button variant="primary" className="w-full" onClick={onBack}>
                            {t('pix.goBack')}
                        </Button>
                    </div>
                ) : (
                    <>
                        <div className="flex flex-col gap-3">
                            <p className="text-center text-body-s text-foreground-secondary">
                                {t('pix.scanWithBankApp')}
                            </p>
                            <CopyToClipboard textToCopy={deposit.brCode} type="button" className="w-full" />
                        </div>

                        <div className="flex items-center gap-2">
                            {user?.user?.fullName && <AvatarWithBadge name={user.user.fullName} size="s" />}
                            <p className="text-body-s text-foreground-secondary">
                                {tAvenia('ownCpf', { cpf: deposit.payerCpfMasked })}
                            </p>
                        </div>
                        {blockedBankNames.length > 0 && (
                            <p className="text-body-s text-foreground-secondary">
                                {tAvenia('blockedBanks', {
                                    banks: format.list(blockedBankNames, { type: 'disjunction' }),
                                })}
                            </p>
                        )}
                    </>
                )}

                <ProviderFinePrint providerId="avenia-br" />
            </PageStack.Center>
        </PageStack>
    )
}
