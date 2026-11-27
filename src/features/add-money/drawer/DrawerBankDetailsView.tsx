'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { Address } from 'viem'
import { Button } from '@/components/0_Bruddle/Button'
import { Callout } from '@/components/0_Bruddle/Callout'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import Loading from '@/components/Global/Loading'
import { useAuth } from '@/context/authContext'
import { DepositAccountDetailsBody } from '@/features/deposit-accounts/components/DepositAccountDetailsBody'
import { DEPOSIT_RAILS } from '@/features/deposit-accounts/rails'
import type { DepositCorridor } from '@/features/deposit-accounts/types'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useDepositAccounts } from '@/features/deposit-accounts/useDepositAccounts'
import { useExchangeRate } from '@/hooks/useExchangeRate'
import { useWallet } from '@/hooks/wallet/useWallet'
import { formatBankAmount, roundUpToDecimals } from '@/utils/currency'
import { withReturnTo } from '@/utils/return-to.utils'
import { addMoneyGapUsd } from './addMoneyDrawerPlan'
import { canReadLiveSpendable, readLiveSpendableUsd } from './readLiveSpendableUsd'

/** Margin on a non-dollar ask: the client rate moves and the conversion takes a fee before the dollars land. */
const BANK_FX_MARGIN = 0.02

/**
 * The held account's bank details, to send the gap from the user's own bank. The body is the
 * details screen's own, so the drawer shows the same rules, fee and arrival. Resuming after the
 * transfer is the place's job (TASK-25169): "I've sent the transfer" hands back to it.
 */
export function DrawerBankDetailsView({
    corridor,
    targetUsd,
    returnTo,
    onSent,
}: {
    corridor: DepositCorridor
    targetUsd: number
    returnTo: string
    /** "I've sent the transfer"; `inDollars`: the transfer was the dollar gap, so the place may name it */
    onSent: (inDollars: boolean) => void
}) {
    const t = useTranslations('card.addMoney')
    const tMethods = useTranslations('addMoney.methods')
    const tBank = useTranslations('addMoney.bankDetails')
    const router = useRouter()
    const { user } = useAuth()
    const queryClient = useQueryClient()
    const { address: wallet } = useWallet()
    const userId = user?.user?.userId
    // the ask is the gap from a fresh read, as the crypto view's (readLiveSpendableUsd), never the
    // place's cached balance; undefined while it loads, null when the read failed. A read belongs to the
    // account and address it was taken for, in the current stretch of that address being readable:
    // until an address is readable, or once it is lost or changes, the skeleton holds (never a stale
    // amount, never a failed read's "no amount"), and every return of an address is read again
    const address = wallet as Address | undefined
    const readKey = canReadLiveSpendable(address) ? `${userId ?? ''}:${address ?? ''}` : null
    const [read, setRead] = useState<{ key: string; gapUsd: number | null }>()
    useEffect(() => {
        // a read from before an outage, even of the same address, is not shown again
        setRead(undefined)
        if (!readKey) return
        let current = true
        readLiveSpendableUsd(queryClient, { address, userId }).then(
            (value) => current && setRead({ key: readKey, gapUsd: addMoneyGapUsd(targetUsd, value) ?? null }),
            () => current && setRead({ key: readKey, gapUsd: null })
        )
        return () => {
            current = false
        }
    }, [queryClient, readKey, address, userId, targetUsd])
    const gapUsd = readKey !== null && read?.key === readKey ? read.gapUsd : undefined
    // a provisioning account is re-read by the hook itself, so the skeleton turns into details here
    const { accounts, isLoading, claim } = useDepositAccounts()
    const { t: tAccounts, accountRailName } = useDepositAccountCopy()
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
            <LinkButton onClick={() => router.push(withReturnTo('/add-money?method=bank', returnTo))}>
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
    // an account with no usable details: a callout under the drawer's one title, not a second heading
    const status = (title: string, body: string, action?: ReactNode) =>
        shell(
            <>
                <Callout priority="attention" title={title}>
                    {body}
                </Callout>
                {action}
            </>
        )

    if (isLoading) return shell(<Loading />)

    if (account?.status === 'revoked') {
        return status(tAccounts('details.revokedTitle', { currency: rail.currency }), tAccounts('details.revokedBody'))
    }
    // the client's own answer once the provisioning poll spent its budget
    if (account?.timedOut) {
        return status(
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
            tAccounts('details.unavailableTitle', { currency: rail.currency }),
            tAccounts('details.unavailableBody')
        )
    }

    // The drawer title carries no amount, so the amount is said here, in the currency the user sends.
    // Another currency is the gap at the client rate plus BANK_FX_MARGIN, rounded up to a whole unit and
    // never under the account's own minimum. While the balance or the rate loads, a skeleton of the same
    // two lines holds its place; with no fresh balance or no rate it promises no amount.
    let amountLine: string | undefined
    const rateLoading = gapUsd === undefined || (!!gapUsd && nonUsd && isRateLoading)
    if (gapUsd && !nonUsd) amountLine = t('sendAsk', { amount: formatBankAmount(gapUsd, 'USD') })
    else if (gapUsd && !rateLoading) {
        const minimum = account.rules?.min?.currency === rail.currency ? Number(account.rules.min.amount) || 0 : 0
        amountLine =
            exchangeRate > 0
                ? t('sendAbout', {
                      amount: formatBankAmount(
                          Math.max(roundUpToDecimals(gapUsd * exchangeRate * (1 + BANK_FX_MARGIN), 0), minimum),
                          rail.currency
                      ),
                  })
                : t('sendInCurrency', { currency: rail.currency })
    }

    return shell(
        <>
            {rateLoading && (
                <div
                    className="flex flex-col gap-1 py-0.5"
                    aria-hidden
                    data-testid="card-add-money-bank-amount-loading"
                >
                    <div className="h-4 w-full animate-pulse rounded bg-background-skeleton" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-background-skeleton" />
                </div>
            )}
            {amountLine && (
                <p className="text-body-m-semibold text-foreground-primary" data-testid="card-add-money-bank-amount">
                    {amountLine}
                </p>
            )}
            {/* which account, as the bank list names it: a caption, so the drawer keeps one heading */}
            <p className="text-body-s text-foreground-secondary" data-testid="card-add-money-bank-account">
                {tAccounts('details.heading', {
                    currency: rail.currency,
                    rail: accountRailName(rail.corridor, account.instructions),
                })}
            </p>
            <DepositAccountDetailsBody
                rail={rail}
                account={account}
                userName={user?.user.fullName || user?.user.username || ''}
                withHeading={false}
            />
            {usable && (
                <Button variant="primary" className="w-full" onClick={() => onSent(!nonUsd)}>
                    {tBank('sentTransfer')}
                </Button>
            )}
        </>
    )
}
