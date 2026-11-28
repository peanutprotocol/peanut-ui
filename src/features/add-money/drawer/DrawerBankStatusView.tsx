'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import type { DrawerBankPlan } from './addMoneyDrawerPlan'
import { DrawerStatus } from './DrawerStatus'

/** the bank states the user can act on; the ones they cannot are disabled rows on the place (Kush) */
export type DrawerBankStatus = Extract<DrawerBankPlan, { kind: 'not-verified' | 'finish-setup' | 'not-offered' }>

/**
 * Why no bank details show yet, and the one thing that moves the user on, with crypto as the
 * tertiary way to add money now. A not-offered answer here has no known residence rule (that one is
 * a disabled row), so it may be "not opened yet": the bank page has the step left.
 */
export function DrawerBankStatusView({
    status,
    onUseCrypto,
    onVerify,
    onFinishSetup,
}: {
    status: DrawerBankStatus
    onUseCrypto: () => void
    onVerify: () => void
    onFinishSetup: () => void
}) {
    const t = useTranslations('card.addMoney')
    const tGate = useTranslations('depositAccounts.gate')
    const tCommon = useTranslations('common')

    const tertiary = (
        // mt-4 on the gap-2 column keeps XL/24 between the primary and the link
        <div className="mt-4 flex justify-center">
            <LinkButton onClick={onUseCrypto} data-testid="card-add-money-use-crypto">
                {t('useCryptoInstead')}
            </LinkButton>
        </div>
    )

    const content =
        status.kind === 'not-verified'
            ? {
                  icon: <IconBubble {...CONCEPT_ICONS.verification} />,
                  title: t('notVerifiedTitle'),
                  body: t('notVerifiedBody'),
                  primary: (
                      <Button
                          variant="primary"
                          className="w-full"
                          onClick={onVerify}
                          data-testid="card-add-money-verify"
                      >
                          {tGate('verifyCta')}
                      </Button>
                  ),
              }
            : {
                  icon: <IconBubble icon="alert" color="yellow" />,
                  title: t('finishSetupTitle'),
                  body: t('finishSetupBody'),
                  primary: (
                      <Button variant="primary" className="w-full" onClick={onFinishSetup}>
                          {tCommon('continue')}
                      </Button>
                  ),
              }

    return (
        <DrawerStatus
            icon={content.icon}
            name={content.title}
            body={content.body}
            testId={`card-add-money-status-${status.kind}`}
        >
            {content.primary}
            {tertiary}
        </DrawerStatus>
    )
}
