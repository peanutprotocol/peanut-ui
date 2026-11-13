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
import { BRIDGE_TRANSFER_STATES, pixPayoutShown, pixWithdrawOutcome } from '@/features/pix/pixFlow.utils'
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
/** From this wait on, the ending never holds the user on the loader (ruling D7): it says when the Pix usually lands. */
const LONG_WAIT_SECONDS = 120

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
 * review); a payout still open after it reads as on its way, with Done. A
 * payout that takes minutes (a quote of 2 minutes or more, or a Bridge
 * transfer read after a reload) shows no loader at all (ruling D7): on its way
 * at once, with when it usually lands and Done; the screen keeps following the
 * entry while it stays open. A payout to another person's key (the quote's
 * `ownAccount` false, or the entry's `pixPayee`) reads as a send to them.
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
    const tRate = useTranslations('exchangeRate')
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

    const arrivalSeconds = sent?.display.arrivalEstimateSeconds
    const arrivalMs = (arrivalSeconds ?? FALLBACK_ARRIVAL_SECONDS) * 1000
    // minutes, not seconds: the quote says so, or after a reload the entry is a Bridge transfer
    const waitsMinutes =
        (arrivalSeconds ?? 0) >= LONG_WAIT_SECONDS ||
        (!sent && !!entry.data?.status && BRIDGE_TRANSFER_STATES.includes(entry.data.status))
    const [pastArrival, setPastArrival] = useState(false)
    useEffect(() => {
        if (outcome !== 'on-its-way' || waitsMinutes) return
        const timer = setTimeout(() => setPastArrival(true), arrivalMs)
        return () => clearTimeout(timer)
    }, [outcome, arrivalMs, waitsMinutes])
    // another person's key: a send to them, by the name the provider validated
    const toOtherPerson = sent ? sent.display.ownAccount === false : entry.data?.extraData?.pixPayee === 'other'

    // the receipt behind "See receipt": the landed withdrawal's entry, mapped the way Activity maps it
    const receipt = useMemo(
        () => (outcome === 'arrived' && entry.data ? mapTransactionDataForDrawer(entry.data).transactionDetails : null),
        [outcome, entry.data]
    )

    if (!sent && entry.isLoading) return <Loading variant="mascot" />

    // the entry's reais: Bridge sends its currency code in lower case, and its final reais once paid
    const entryBrl = entry.data?.currency?.code?.toUpperCase() === 'BRL' ? entry.data.currency.amount : undefined
    // an estimate stays marked until the provider states what it paid
    const amountBrl =
        outcome === 'arrived' && sent?.display.amountBrlEstimated && entryBrl
            ? entryBrl
            : (sent?.display.amountBrl ?? entryBrl)
    const amountShown = amountBrl
        ? outcome !== 'arrived' && sent
            ? pixPayoutShown({ ...sent.display, amountBrl })
            : formatBankAmount(amountBrl, 'BRL')
        : undefined

    if (outcome === 'on-its-way' && !pastArrival && !waitsMinutes) {
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
        const holder = sent?.display.holderName ?? entry.data?.recipientAccount?.fullName
        // The view is the page shell: it renders the header with its cancel (as the crypto withdrawal
        // mounts it), and both the cancel and Back to home leave to home, then `onDone`. A shell around
        // it would stack two min-h-inherit regions and push the card down (Chip, 37aafd073).
        return (
            <PaymentSuccessView
                type="SEND"
                headerTitle={title}
                isWithdrawFlow
                // a send to another person reads "Sent", to them by name
                isFromSendFlow={toOtherPerson}
                currencyAmount={amountShown}
                secondaryAmount={amountUsd ? formatBankAmount(amountUsd, 'USD') : undefined}
                // the view prefixes it with "to" (payment.success.toPrefix), as for every withdrawal
                message={
                    toOtherPerson && holder
                        ? holder
                        : pixKey
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

    const to = sent
        ? [sent.display.bankName, sent.display.holderName].filter(Boolean).join(' · ')
        : toOtherPerson
          ? (entry.data?.recipientAccount?.fullName ?? '')
          : ''
    const failed = outcome === 'not-sent' || outcome === 'refunded' || outcome === 'stuck'
    // when the Pix usually lands, where the wait is minutes: the quote's estimate, else in general
    const arrival = waitsMinutes
        ? arrivalSeconds
            ? t('arrivesIn', { minutes: Math.round(arrivalSeconds / 60) })
            : tRate('widget.arrivesMinutes')
        : null
    const onItsWay = to ? t('sentTo', { destination: to }) : t('sent')
    const description = {
        'on-its-way': arrival ? `${onItsWay} ${arrival}` : onItsWay,
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
                <TitleBlock align="center" title={amountShown ?? title} description={description} />
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
