'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { TitleBlock } from '@/components/0_Bruddle/TitleBlock'
import Loading from '@/components/Global/Loading'
import { useAuth } from '@/context/authContext'
import { CARD_FUNDING_RETURN_TO } from '@/features/card/cardAddMoney'
import { DepositAccountDetailsBody } from '@/features/deposit-accounts/components/DepositAccountDetailsBody'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { formatBankAmount, roundUpToDecimals } from '@/utils/currency'
import { withReturnTo } from '@/utils/return-to.utils'

/**
 * The held account's bank details, to send the gap from the user's own bank. The body is the
 * details screen's own, so the drawer shows the same rules, fee and arrival. Resuming after the
 * transfer is the funding step's job (TASK-25169): "I've sent the transfer" hands back to it.
 */
export function CardBankDetailsView({
    corridor,
    gapUsd,
    onSent,
}: {
    corridor: DepositCorridor
    gapUsd: number | undefined
    onSent: () => void
}) {
    const t = useTranslations('card.addMoney')
    const tMethods = useTranslations('addMoney.methods')
    const tBank = useTranslations('addMoney.bankDetails')
    const router = useRouter()
    const { user } = useAuth()
    // a provisioning account is re-read by the hook itself, so the skeleton turns into details here
    const { accounts, isLoading, claim } = useDepositAccounts()
    const { t: tAccounts } = useDepositAccountCopy()
    const rail = DEPOSIT_RAILS[corridor]
    const account = accounts[corridor]
    const nonUsd = rail.currency !== 'USD'
    const { exchangeRate, isLoading: isRateLoading } = useExchangeRate({
        sourceCurrency: 'USD',
        destinationCurrency: rail.currency,
        enabled: nonUsd && !!gapUsd,
    })

    const moreWays = (
        <div className="mt-2 flex justify-center">
            <LinkButton onClick={() => router.push(withReturnTo('/add-money?method=bank', CARD_FUNDING_RETURN_TO))}>
                {tMethods('moreWays')}
            </LinkButton>
        </div>
    )
    const shell = (children: ReactNode) => (
        <div className="flex flex-col gap-4" data-testid="card-add-money-bank-details">
            {children}
            {moreWays}
        </div>
    )
    const status = (icon: ReactNode, title: string, body: string, action?: ReactNode) =>
        shell(
            <div className="flex flex-col items-center gap-4 text-center">
                {icon}
                <TitleBlock align="center" size="s" title={title} description={body} />
                {action}
            </div>
        )

    if (isLoading) return shell(<Loading />)

    if (account?.status === 'revoked') {
        return status(
            <IconBubble icon="lock" color="gray" />,
            tAccounts('details.revokedTitle', { currency: rail.currency }),
            tAccounts('details.revokedBody')
        )
    }
    // the client's own answer once the provisioning poll spent its budget
    if (account?.timedOut) {
        return status(
            <IconBubble icon="error" color="red" />,
            tAccounts('details.timedOutTitle', { currency: rail.currency }),
            tAccounts('details.timedOutBody'),
            <Button variant="primary" className="w-full" onClick={() => claim(corridor)}>
                {tAccounts('details.timedOutRetry')}
            </Button>
        )
    }
    const provisioning = account?.status === 'provisioning'
    const usable = (account?.status === 'active' || account?.status === 'retiring') && !!account.instructions
    if (!account || (!provisioning && !usable)) {
        return status(
            <IconBubble icon="lock" color="gray" />,
            tAccounts('details.unavailableTitle', { currency: rail.currency }),
            tAccounts('details.unavailableBody')
        )
    }

    // The drawer title names the dollar gap, so a dollar account needs no amount line. Another
    // currency names the gap in that currency, rounded up to a whole unit so a moving rate and the
    // conversion fee do not leave the user short; with no rate it promises no amount.
    let amountLine: string | undefined
    if (nonUsd && gapUsd && !isRateLoading) {
        amountLine =
            exchangeRate > 0
                ? t('sendAbout', {
                      amount: formatBankAmount(roundUpToDecimals(gapUsd * exchangeRate, 0), rail.currency),
                  })
                : t('sendInCurrency', { currency: rail.currency })
    }

    return shell(
        <>
            {amountLine && <p className="text-body-m text-foreground-primary">{amountLine}</p>}
            <DepositAccountDetailsBody
                rail={rail}
                account={account}
                userName={user?.user.fullName || user?.user.username || ''}
            />
            {usable && (
                <Button variant="primary" className="w-full" onClick={onSent}>
                    {tBank('sentTransfer')}
                </Button>
            )}
        </>
    )
}
