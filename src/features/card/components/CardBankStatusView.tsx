'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { CardBankPlan } from '@/features/card/cardAddMoney'
import { useBankRegionRefusal } from '@/features/card/useBankRegionRefusal'
import { formatBankAmount } from '@/utils/currency'

export type CardBankStatus = Extract<
    CardBankPlan,
    { kind: 'setting-up' | 'under-review' | 'not-verified' | 'finish-setup' | 'not-offered' }
>

/**
 * Why no bank details show yet, and the one thing that moves the user on. Crypto works for every
 * one of these users now, so each status offers it: as the primary where nothing else can be done,
 * as the tertiary link beside the user's own next step. The provider gives no time, so none shows.
 */
export function CardBankStatusView({
    status,
    gapUsd,
    onUseCrypto,
    onVerify,
    onFinishSetup,
    onChangeResidence,
}: {
    status: CardBankStatus
    gapUsd: number | undefined
    onUseCrypto: () => void
    onVerify: () => void
    onFinishSetup: () => void
    onChangeResidence: () => void
}) {
    const t = useTranslations('card.addMoney')
    const tKyc = useTranslations('kyc.paperworkVerification')
    const tGate = useTranslations('depositAccounts.gate')
    const tAccounts = useTranslations('profile.unlockPayments')
    const tDeposit = useTranslations('depositAccounts')
    const tCommon = useTranslations('common')
    const regionRefusal = useBankRegionRefusal()

    const cryptoPrimary = (
        <Button variant="primary" className="w-full" onClick={onUseCrypto} data-testid="card-add-money-use-crypto">
            {gapUsd ? t('useCrypto', { amount: formatBankAmount(gapUsd, 'USD') }) : t('useCryptoNoAmount')}
        </Button>
    )
    const tertiary = (label: string, onClick: () => void, testId?: string) => (
        // mt-4 on the gap-2 column keeps XL/24 between the primary and the link
        <div className="mt-4 flex justify-center">
            <LinkButton onClick={onClick} data-testid={testId}>
                {label}
            </LinkButton>
        </div>
    )
    const cryptoTertiary = tertiary(t('useCryptoInstead'), onUseCrypto, 'card-add-money-use-crypto')

    const finishSetup = {
        icon: <IconBubble icon="alert" color="yellow" />,
        title: t('finishSetupTitle'),
        body: t('finishSetupBody'),
        actions: (
            <>
                <Button variant="primary" className="w-full" onClick={onFinishSetup}>
                    {tCommon('continue')}
                </Button>
                {cryptoTertiary}
            </>
        ),
    }

    const content = (() => {
        switch (status.kind) {
            case 'setting-up':
                return {
                    icon: <IconBubble icon="clock" color="yellow" />,
                    title: tKyc('activation.settingUpTitle', { currency: DEPOSIT_RAILS[status.corridor].currency }),
                    body: t('settingUpBody'),
                    actions: cryptoPrimary,
                }
            case 'under-review':
                return {
                    icon: <IconBubble icon="clock" color="yellow" />,
                    title: t('underReviewTitle'),
                    body: t('underReviewBody'),
                    actions: cryptoPrimary,
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
                            {cryptoTertiary}
                        </>
                    ),
                }
            case 'finish-setup':
                return finishSetup
            // A known residence rule: say so, in gray (not available), with the one fix, a move. Anything
            // else the API calls not offered may be "not opened yet": the bank page has the step left.
            case 'not-offered':
                return regionRefusal
                    ? {
                          icon: <IconBubble {...CONCEPT_ICONS.bank} color="gray" />,
                          title: t('notOfferedTitle'),
                          body: tAccounts('bankOnlyNotAvailableNote'),
                          actions: (
                              <>
                                  {cryptoPrimary}
                                  {tertiary(
                                      tDeposit('details.residenceCta'),
                                      onChangeResidence,
                                      'card-add-money-residence'
                                  )}
                              </>
                          ),
                      }
                    : finishSetup
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
