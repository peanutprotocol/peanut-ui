'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { PageStack } from '@/components/0_Bruddle/PageStack'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import Loading from '@/components/Global/Loading'
import NavHeader from '@/components/Global/NavHeader'
import { SoundPlayer } from '@/components/Global/SoundPlayer'
import { ProviderFinePrint } from '@/components/Provider/ProviderFinePrint'
import { pixWithdrawOutcome } from '@/features/pix/pixFlow.utils'
import { pixNewKeyUrl } from '@/features/pix/pixRecovery'
import { depositMaybeSent } from '@/features/pix/pixWithdrawSent'
import { useModalsContext } from '@/context/ModalsContext'
import { useHistoryEntry } from '@/hooks/useHistoryEntry'
import { useReturnTo } from '@/hooks/useSafeBack'
import type { PixWithdrawDisplay } from '@/services/pix'
import type { ProviderId } from '@/types/provider.types'
import { formatBankAmount } from '@/utils/currency'

/**
 * The last step of a Pix withdrawal (`?intentId=`). The withdrawal's history
 * entry says whether the provider paid the Pix. `sent` is what this session signed;
 * after a reload it is null and the screen reads the amount from the entry.
 * A deposit this device may have sent counts as unconfirmed until the entry
 * says otherwise; one it never sent reads as not sent, with a way to start again.
 */
export function PixWithdrawOutcome({
    title,
    intentId,
    providerId,
    sent,
    onStartAgain,
}: {
    title: string
    intentId: string
    /** The provider the route names, for its row and sheet; null shows no row. */
    providerId: ProviderId | null
    sent: { phase: 'funded' | 'unconfirmed'; display: PixWithdrawDisplay } | null
    /** Nothing left the wallet: a new withdrawal. */
    onStartAgain: () => void
}) {
    const t = useTranslations('pix.withdraw')
    const tShared = useTranslations('pix')
    const tCommon = useTranslations('common')
    const router = useRouter()
    const leaveToHome = useReturnTo('/home')
    const { setIsSupportModalOpen } = useModalsContext()
    const entry = useHistoryEntry(intentId, 'OFFRAMP')

    if (!sent && entry.isLoading) return <Loading variant="mascot" />

    const amountBrl =
        sent?.display.amountBrl ?? (entry.data?.currency?.code === 'BRL' ? entry.data.currency.amount : undefined)
    const to = sent ? [sent.display.bankName, sent.display.holderName].filter(Boolean).join(' · ') : ''
    const outcome = pixWithdrawOutcome(
        sent?.phase ?? (depositMaybeSent(intentId) ? 'unconfirmed' : 'unsigned'),
        entry.data
    )
    const failed = outcome === 'not-sent' || outcome === 'refunded' || outcome === 'stuck'
    const description = {
        arrived: to ? t('arrivedTo', { destination: to }) : t('arrived'),
        'on-its-way': to ? t('sentTo', { destination: to }) : t('sent'),
        unconfirmed: t('unconfirmed'),
        'needs-key': tShared('recovery.notice'),
        refunded: t('refunded'),
        'not-sent': t('notSent'),
        stuck: t('stuck'),
    }[outcome]

    return (
        <PageStack>
            {outcome === 'arrived' && <SoundPlayer sound="success" />}
            <NavHeader title={title} hideBackBtn />
            <PageStack.Center className="items-center text-center">
                {/* a funded withdrawal is a wait, not a success, until the provider's payout completes the entry */}
                <IconBubble
                    icon={outcome === 'arrived' ? 'check' : failed || outcome === 'needs-key' ? 'alert' : 'clock'}
                    size="l"
                    color={outcome === 'arrived' ? 'green' : failed ? 'red' : 'yellow'}
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
                            onClick={() => router.push(pixNewKeyUrl(intentId))}
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
