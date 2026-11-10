'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { parseAsString, useQueryState } from 'nuqs'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import Badge from '@/components/Global/Badges/Badge'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { ReceiptUnavailable } from '@/components/TransactionDetails/ReceiptUnavailable'
import { mapTransactionDataForDrawer } from '@/components/TransactionDetails/transactionTransformer'
import { awaitsNewPixKey } from '@/features/avenia/aveniaRecovery'
import { AveniaPixKeyStep } from '@/features/avenia/components/AveniaPixKeyStep'
import { useAveniaRecoveryKey } from '@/features/avenia/hooks/useAveniaRecoveryKey'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'
import { useReturnTo, useSafeBack } from '@/hooks/useSafeBack'
import type { PixKeyInfo } from '@/services/pix'

/**
 * Another own Pix key for a withdrawal whose payout the bank refused for its
 * key or account. The money waits with Avenia; once the API takes the key,
 * its recovery queue pays it there. The withdrawal is `?intentId=` in the URL,
 * so its receipt and its notification open this screen directly, and the key
 * rides in `?destination=` as on the withdraw flow. A
 * withdrawal that no longer waits for a key (paid, refunded, or a key already
 * given) shows its current state instead.
 */
export function AveniaNewKeyFlow() {
    const t = useTranslations('avenia.recovery')
    const tNav = useTranslations('navigation')
    const tCommon = useTranslations('common')
    const title = tNav('withdraw')
    // a notification opens this screen with no in-app history behind it
    const back = useSafeBack('/home')
    const leaveToHome = useReturnTo('/home')
    const [intentId] = useQueryState('intentId', parseAsString.withDefault(''))
    const [destination, setDestination] = useQueryState('destination', parseAsString.withDefault(''))
    const entry = useHistoryEntry(intentId || null, 'OFFRAMP')
    const recovery = useAveniaRecoveryKey(intentId)
    // the lookup's holder and bank, for the line that says where the money goes
    const [holder, setHolder] = useState<PixKeyInfo | null>(null)

    if (!intentId || (entry.isError && !entry.data)) {
        return (
            <PageStack>
                <NavHeader title={title} onPrev={back} />
                <PageStack.Center>
                    <ReceiptUnavailable
                        variant="loadFailed"
                        onRetry={intentId ? () => void entry.refetch() : undefined}
                    />
                </PageStack.Center>
            </PageStack>
        )
    }
    if (!entry.data) return <Loading variant="mascot" />

    if (recovery.phase === 'accepted') {
        const destination = [holder?.bankName, holder?.holderName].filter(Boolean).join(' · ')
        return (
            <PageStack>
                <NavHeader title={title} hideBackBtn />
                <PageStack.Center className="items-center text-center">
                    <IconBubble icon="check" size="l" color="green" />
                    <TitleBlock
                        align="center"
                        title={t('savedTitle')}
                        description={destination ? t('savedTo', { destination }) : t('saved')}
                    />
                    <Button variant="primary" className="w-full" onClick={leaveToHome}>
                        {tCommon('done')}
                    </Button>
                    <ProviderFinePrint providerId="avenia-br" />
                </PageStack.Center>
            </PageStack>
        )
    }

    if (recovery.phase === 'not-waiting' || !awaitsNewPixKey(entry.data.extraData)) {
        const { status } = mapTransactionDataForDrawer(entry.data).transactionDetails
        return (
            <PageStack>
                <NavHeader title={title} onPrev={back} />
                <PageStack.Center className="items-center text-center" data-testid="avenia-new-key-not-waiting">
                    <IconBubble icon="info" size="l" color="blue" />
                    <TitleBlock align="center" title={t('notWaitingTitle')} description={t('notWaiting')} />
                    {/* the withdrawal's own state now, as its receipt shows it */}
                    {status && <Badge status={status} />}
                    <Button variant="primary" className="w-full" onClick={leaveToHome}>
                        {tCommon('done')}
                    </Button>
                </PageStack.Center>
            </PageStack>
        )
    }

    return (
        <AveniaPixKeyStep
            title={title}
            initialKey={destination}
            intro={t('intro')}
            onBack={back}
            isSubmitting={recovery.phase === 'submitting'}
            refusal={recovery.refusal}
            onContinue={(key, info) => {
                setHolder(info)
                void setDestination(key)
                void recovery.submit(key)
            }}
        />
    )
}
