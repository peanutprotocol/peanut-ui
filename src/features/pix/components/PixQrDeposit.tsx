'use client'

import { useMemo } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import ProcessingScreen from '@/components/Global/ProcessingScreen'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import AvatarWithBadge from '@/components/Profile/AvatarWithBadge'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { useAuth } from '@/context/authContext'
import { usePixDeposit } from '@/features/pix/usePixDeposit'
import { useExpiryCountdown } from '@/hooks/useExpiryCountdown'
import { formatBankAmount } from '@/utils/currency'

/**
 * The dynamic Pix code of one Avenia deposit (`?intentId=`), read from GET
 * /avenia/deposit/:intentId: the amount in reais, what the balance gets, the
 * time the code has left, and who the payer must be (an account under the
 * user's own CPF: Avenia returns any other Pix). A reload, back navigation
 * and a deep link draw the same code. A code that lapsed or a Pix that came
 * back says so, and the way on is a new deposit, never a dead code.
 */
export function PixQrDeposit({
    intentId,
    blockedBankNames,
    onBack,
    onDone,
    onNewDeposit,
    onComplete,
}: {
    intentId: string
    /** Banks whose Pix Avenia sends back (GET /avenia/deposit/eligibility). */
    blockedBankNames: string[]
    /** Leaves the flow. */
    onBack: () => void
    /** Leaves the flow once the deposit is received. */
    onDone: () => void
    /** The amount step for another deposit: offered once this code cannot be paid. */
    onNewDeposit: () => void
    onComplete: () => void
}) {
    const t = useTranslations('addMoney')
    const tDeposit = useTranslations('pix.deposit')
    const tShared = useTranslations('pix')
    const tCommon = useTranslations('common')
    const format = useFormatter()
    const { user } = useAuth()
    const { deposit, phase, isError } = usePixDeposit(intentId, onComplete)

    const expiresAtMs = useMemo(() => (deposit?.expiresAt ? Date.parse(deposit.expiresAt) : null), [deposit?.expiresAt])
    const countdown = useExpiryCountdown(expiresAtMs, phase === 'pending')
    const isExpired = phase === 'expired' || countdown.isExpired

    if (!deposit) {
        if (!isError) return <Loading variant="mascot" />
        // the read keeps polling, so the screen recovers on its own once the API answers
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="alert" size="l" color="red" />
                    <TitleBlock align="center" title={t('title')} description={tShared('unavailable')} />
                </PageStack.Center>
            </PageStack>
        )
    }

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
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="alert" size="l" color="red" />
                    <TitleBlock
                        align="center"
                        title={tDeposit('returnedTitle')}
                        description={tDeposit('returnedBody')}
                    />
                    <Button variant="primary" className="w-full" onClick={onNewDeposit}>
                        {tDeposit('startNew')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    if (isExpired || !deposit.brCode) {
        return (
            <PageStack>
                <NavHeader title={t('title')} onPrev={onBack} />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="clock" size="l" color="yellow" />
                    <TitleBlock
                        align="center"
                        title={deposit.amountBrl ? formatBankAmount(deposit.amountBrl, 'BRL') : t('title')}
                        description={t('pix.qrExpired')}
                    />
                    <Button variant="primary" className="w-full" onClick={onNewDeposit}>
                        {tDeposit('startNew')}
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
                    {deposit.amountBrl && (
                        <p className="text-heading-s text-foreground-primary">
                            {formatBankAmount(deposit.amountBrl, 'BRL')}
                        </p>
                    )}
                    {/* Avenia's fees are already out of the quote: this is what the balance receives */}
                    {deposit.usdcAmount && (
                        <p className="text-body-s text-foreground-secondary">
                            {tDeposit('youGet', { amount: formatBankAmount(deposit.usdcAmount, 'USD') })}
                        </p>
                    )}
                    {deposit.fixedFeeBrl && (
                        <p className="text-body-s text-foreground-secondary">
                            {tDeposit('fee', { amount: formatBankAmount(deposit.fixedFeeBrl, 'BRL') })}
                        </p>
                    )}
                    {countdown.timeLeft && (
                        <p className="text-body-s text-foreground-secondary">
                            {t('pix.expiresIn', { time: countdown.timeLeft })}
                        </p>
                    )}
                </div>

                <QRCodeWrapper url={deposit.brCode} className="mx-auto max-w-[280px]" />

                <div className="flex flex-col gap-3">
                    <p className="text-center text-body-s text-foreground-secondary">{t('pix.scanWithBankApp')}</p>
                    <CopyToClipboard textToCopy={deposit.brCode} type="button" className="w-full" />
                </div>

                {deposit.payerCpfMasked && (
                    <div className="flex items-center gap-2">
                        {user?.user?.fullName && <AvatarWithBadge name={user.user.fullName} size="s" />}
                        <p className="text-body-s text-foreground-secondary">
                            {tDeposit('ownCpf', { cpf: deposit.payerCpfMasked })}
                        </p>
                    </div>
                )}
                {blockedBankNames.length > 0 && (
                    <p className="text-body-s text-foreground-secondary">
                        {tDeposit('blockedBanks', { banks: format.list(blockedBankNames, { type: 'disjunction' }) })}
                    </p>
                )}

                <ProviderFinePrint providerId="avenia-br" />
            </PageStack.Center>
        </PageStack>
    )
}
