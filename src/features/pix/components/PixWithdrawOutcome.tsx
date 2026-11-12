'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import PaymentProcessingScreen from '@/components/Global/PaymentProcessingScreen'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import PaymentSuccessView from '@/features/payments/shared/components/PaymentSuccessView'
import { pixWithdrawOutcome } from '@/features/pix/pixFlow.utils'
import { pixNewKeyUrl } from '@/features/pix/pixRecovery'
import { depositMaybeSent } from '@/features/pix/pixWithdrawSent'
import { useModalsContext } from '@/context/ModalsContext'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'
import { useReturnTo } from '@/hooks/useSafeBack'
import type { PixWithdrawDisplay } from '@/services/pix'
import type { ProviderId } from '@/types/provider.types'
import { formatBankAmount } from '@/utils/currency'

/** How long the payout may stay open before the loader gives way, when no quote states an arrival time (a reload). */
const FALLBACK_ARRIVAL_SECONDS = 90

/**
 * The last step of a Pix withdrawal (`?intentId=`). The withdrawal's history
 * entry says whether the provider paid the Pix. `sent` is what this session signed;
 * after a reload it is null and the screen reads the amount from the entry.
 * A deposit this device may have sent counts as unconfirmed until the entry
 * says otherwise; one it never sent reads as not sent, with a way to start again.
 *
 * It ends like every other withdrawal (ruling 2026-11-12): the shared payment
 * loader while the provider pays, the shared success view once the Pix landed.
 * The loader lasts at most the quoted arrival time ("About 1 minute" on the
 * review); a payout still open after it reads as on its way, with Done.
 */
export function PixWithdrawOutcome({
    title,
    intentId,
    providerId,
    sent,
    onStartAgain,
    onDone,
}: {
    title: string
    /** Null when the submit could not name the withdrawal: the screen then shows what was signed. */
    intentId: string | null
    /** The provider the route names, for its row and sheet; null shows no row. */
    providerId: ProviderId | null
    sent: { phase: 'funded' | 'unconfirmed'; display: PixWithdrawDisplay } | null
    /** Nothing left the wallet: a new withdrawal. */
    onStartAgain: () => void
    /** The user leaves the flow through this screen: the flow forgets its form. */
    onDone: () => void
}) {
    const t = useTranslations('pix.withdraw')
    const tShared = useTranslations('pix')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const returnHome = useReturnTo('/home')
    const leaveToHome = () => {
        onDone()
        returnHome()
    }
    const { setIsSupportModalOpen } = useModalsContext()
    const entry = useHistoryEntry(intentId, 'OFFRAMP')
    const outcome = pixWithdrawOutcome(
        sent?.phase ?? (intentId && depositMaybeSent(intentId) ? 'unconfirmed' : 'unsigned'),
        entry.data
    )

    const arrivalMs = (sent?.display.arrivalEstimateSeconds ?? FALLBACK_ARRIVAL_SECONDS) * 1000
    const [pastArrival, setPastArrival] = useState(false)
    useEffect(() => {
        if (outcome !== 'on-its-way') return
        const timer = setTimeout(() => setPastArrival(true), arrivalMs)
        return () => clearTimeout(timer)
    }, [outcome, arrivalMs])

    // the receipt behind "See receipt": the landed withdrawal's entry, mapped the way Activity maps it
    const receipt = useMemo(
        () => (outcome === 'arrived' && entry.data ? mapTransactionDataForDrawer(entry.data).transactionDetails : null),
        [outcome, entry.data]
    )

    if (!sent && entry.isLoading) return <Loading variant="mascot" />

    const amountBrl =
        sent?.display.amountBrl ?? (entry.data?.currency?.code === 'BRL' ? entry.data.currency.amount : undefined)

    if (outcome === 'on-its-way' && !pastArrival) {
        return (
            <PageStack>
                <NavHeader title={title} hideBackBtn />
                <PaymentProcessingScreen title={t('processingTitle')} />
            </PageStack>
        )
    }

    if (outcome === 'arrived') {
        const pixKey = sent?.display.pixKey ?? entry.data?.recipientAccount?.identifier
        // the entry names no bank: after a reload the line carries the key alone
        const bank = sent?.display.bankName
        const amountUsd = sent?.display.withdrawUsd ?? entry.data?.amount
        // The view is the page shell: it renders the header with its cancel (as the crypto withdrawal
        // mounts it), and both the cancel and Back to home leave to home, then `onDone`. A shell around
        // it would stack two min-h-inherit regions and push the card down (Chip, 37aafd073).
        return (
            <PaymentSuccessView
                type="SEND"
                headerTitle={title}
                isWithdrawFlow
                currencyAmount={amountBrl ? formatBankAmount(amountBrl, 'BRL') : undefined}
                secondaryAmount={amountUsd ? formatBankAmount(amountUsd, 'USD') : undefined}
                // the view prefixes it with "to" (payment.success.toPrefix), as for every withdrawal
                message={
                    pixKey
                        ? bank
                            ? t('withdrawnTo', { key: pixKey, bank })
                            : t('withdrawnToKey', { key: pixKey })
                        : undefined
                }
                transactionDetails={receipt}
                providerId={providerId ?? undefined}
                onComplete={onDone}
            />
        )
    }

    const to = sent ? [sent.display.bankName, sent.display.holderName].filter(Boolean).join(' · ') : ''
    const failed = outcome === 'not-sent' || outcome === 'refunded' || outcome === 'stuck'
    const description = {
        'on-its-way': to ? t('sentTo', { destination: to }) : t('sent'),
        unconfirmed: t('unconfirmed'),
        'needs-key': tShared('recovery.notice'),
        refunded: t('refunded'),
        'not-sent': t('notSent'),
        stuck: t('stuck'),
    }[outcome]

    return (
        <PageStack>
            <NavHeader title={title} hideBackBtn />
            <PageStack.Center className="items-center text-center">
                {/* a funded withdrawal is a wait, not a success, until the provider's payout completes the entry */}
                <IconBubble
                    icon={failed || outcome === 'needs-key' ? 'alert' : 'clock'}
                    size="l"
                    color={failed ? 'red' : 'yellow'}
                />
                <TitleBlock
                    align="center"
                    title={amountBrl ? formatBankAmount(amountBrl, 'BRL') : title}
                    description={description}
                />
                {outcome === 'needs-key' ? (
                    <>
                        <Button
                            variant="primary"
                            className="w-full"
                            onClick={() => intentId && router.push(pixNewKeyUrl(intentId))}
                        >
                            {tShared('recovery.addKey')}
                        </Button>
                        <LinkButton onClick={leaveToHome}>{tCommon('done')}</LinkButton>
                    </>
                ) : outcome === 'stuck' ? (
                    <>
                        <Button variant="primary" className="w-full" onClick={() => setIsSupportModalOpen(true)}>
                            {tCommon('contactSupport')}
                        </Button>
                        <LinkButton onClick={leaveToHome}>{tCommon('done')}</LinkButton>
                    </>
                ) : outcome === 'not-sent' ? (
                    <>
                        <Button variant="primary" className="w-full" onClick={onStartAgain}>
                            {tCommon('tryAgain')}
                        </Button>
                        <LinkButton onClick={leaveToHome}>{tCommon('done')}</LinkButton>
                    </>
                ) : (
                    <Button variant="primary" className="w-full" onClick={leaveToHome}>
                        {tCommon('done')}
                    </Button>
                )}
                {providerId && <ProviderFinePrint providerId={providerId} />}
            </PageStack.Center>
        </PageStack>
    )
}
