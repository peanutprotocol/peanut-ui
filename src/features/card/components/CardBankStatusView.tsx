'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { CardBankPlan } from '@/features/card/cardAddMoney'
import { formatBankAmount } from '@/utils/currency'

export type CardBankStatus = Extract<
    CardBankPlan,
    { kind: 'setting-up' | 'under-review' | 'not-verified' | 'finish-setup' }
>

/**
 * Why no bank details show yet, and the one thing that moves the user on. Crypto works for every
 * one of these users now, so each status offers it. The provider gives no time, so none shows.
 */
export function CardBankStatusView({
    status,
    gapUsd,
    onUseCrypto,
    onVerify,
    onFinishSetup,
}: {
    status: CardBankStatus
    gapUsd: number | undefined
    onUseCrypto: () => void
    onVerify: () => void
    onFinishSetup: () => void
}) {
    const t = useTranslations('card.addMoney')
    const tKyc = useTranslations('kyc.paperworkVerification')
    const tGate = useTranslations('depositAccounts.gate')
    const tCommon = useTranslations('common')

    const cryptoButton = (variant: 'primary' | 'secondary') => (
        <Button variant={variant} className="w-full" onClick={onUseCrypto} data-testid="card-add-money-use-crypto">
            {gapUsd ? t('useCrypto', { amount: formatBankAmount(gapUsd, 'USD') }) : t('useCryptoNoAmount')}
        </Button>
    )

    const content = (() => {
        switch (status.kind) {
            case 'setting-up':
                return {
                    icon: <IconBubble icon="clock" color="yellow" />,
                    title: tKyc('activation.settingUpTitle', { currency: DEPOSIT_RAILS[status.corridor].currency }),
                    body: t('settingUpBody'),
                    actions: cryptoButton('primary'),
                }
            case 'under-review':
                return {
                    icon: <IconBubble icon="clock" color="yellow" />,
                    title: t('underReviewTitle'),
                    body: t('underReviewBody'),
                    actions: cryptoButton('primary'),
                }
            case 'not-verified':
                return {
                    icon: <IconBubble {...CONCEPT_ICONS.verification} />,
                    title: t('notVerifiedTitle'),
                    body: t('notVerifiedBody'),
                    actions: (
                        <>
                            <Button
                                variant="primary"
                                className="w-full"
                                onClick={onVerify}
                                data-testid="card-add-money-verify"
                            >
                                {tGate('verifyCta')}
                            </Button>
                            {cryptoButton('secondary')}
                        </>
                    ),
                }
            case 'finish-setup':
                return {
                    icon: <IconBubble icon="alert" color="yellow" />,
                    title: t('finishSetupTitle'),
                    body: t('finishSetupBody'),
                    actions: (
                        <>
                            <Button variant="primary" className="w-full" onClick={onFinishSetup}>
                                {tCommon('continue')}
                            </Button>
                            {cryptoButton('secondary')}
                        </>
                    ),
                }
        }
    })()

    return (
        <div
            className="flex flex-col items-center gap-4 text-center"
            data-testid={`card-add-money-status-${status.kind}`}
        >
            {content.icon}
            <TitleBlock align="center" size="s" title={content.title} description={content.body} />
            <div className="flex w-full flex-col gap-2">{content.actions}</div>
        </div>
    )
}
