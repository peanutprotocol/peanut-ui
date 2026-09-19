'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import StatusBadge from '@/components/Global/Badges/StatusBadge'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import Loading from '@/components/Global/Loading'
import { RequestBankInstructions } from '@/features/deposit-accounts/components/RequestBankInstructions'
import {
    bankPayAmountFigure,
    readServerPayerAmount,
    resolveBankPayAmount,
} from '@/features/deposit-accounts/payerAmount'
import { corridorFromRailId } from '@/features/deposit-accounts/rails'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import { useRequestDepositInstructions } from '@/features/deposit-accounts/useRequestDepositInstructions'
import type { RequestPayRail } from '@/services/services.types'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'

/**
 * Pay this request straight into the requester's bank account.
 *
 * Only offered when the requester opted in, and the details are fetched when
 * the payer opens the drawer rather than with the screen: bank details are not
 * something to load into a page the payer may never ask for. They are never on
 * the username page for the same reason — a request link is a thing somebody
 * was given, a public profile is not.
 *
 * With a `rail` from the pay-amounts route the row names the currency and the
 * amount before the tap, and the drawer asks for the account in that currency.
 * Without one — an API that predates the route — the row is generic and the
 * backend picks the account.
 */
export function PayByBankTransferDrawer({
    requestId,
    bankPayable,
    usdAmount,
    remainingUsd,
    rail,
}: {
    requestId: string
    bankPayable: boolean
    /** what this payer entered, in dollars, so they read it in the account's currency */
    usdAmount?: string
    /** what the request still needs, in dollars */
    remainingUsd?: number
    /** the requester's bank rail this row pays into, with what the request still needs on it */
    rail?: RequestPayRail
}) {
    const t = useTranslations('payment')
    const format = useFormatter()
    const { railName } = useDepositAccountCopy()
    const [isOpen, setIsOpen] = useState(false)
    const railCurrency = rail?.payerAmount.currency.toUpperCase()
    const { instructions, isLoading, isUnavailable } = useRequestDepositInstructions(
        requestId,
        bankPayable && isOpen,
        railCurrency
    )

    if (!bankPayable) return null

    const corridor = rail?.railId ? corridorFromRailId(rail.railId) : undefined
    const title =
        railCurrency && corridor
            ? t('bankTransfer.payInCurrency', { currency: railCurrency, rail: railName(corridor) })
            : t('bankTransfer.title')

    // The same resolver the drawer uses, so the row and the details it opens
    // never state two amounts. A dollar fallback is not a rail amount, so the
    // row stays quiet about it.
    const railAmount = railCurrency
        ? resolveBankPayAmount({
              server: readServerPayerAmount(rail?.payerAmount),
              payerUsd: usdAmount,
              remainingUsd,
              accountCurrency: railCurrency,
              clientRate: 0,
          })
        : undefined
    const figure = railAmount?.kind === 'local' ? bankPayAmountFigure(railAmount) : undefined

    return (
        <>
            <ListItem
                position="single"
                title={
                    <div className="flex flex-wrap items-center gap-2">
                        {title}
                        {figure && (
                            <StatusBadge
                                status={figure.approx ? 'custom' : 'completed'}
                                customText={t(figure.approx ? 'bankTransfer.estimateBadge' : 'bankTransfer.exactBadge')}
                            />
                        )}
                    </div>
                }
                body={
                    <div className="text-body-xs">
                        {figure
                            ? t(figure.approx ? 'bankTransfer.amountValueApprox' : 'bankTransfer.amountValue', {
                                  amount: format.number(figure.value, {
                                      minimumFractionDigits: figure.digits,
                                      maximumFractionDigits: figure.digits,
                                  }),
                                  currency: figure.currency,
                              })
                            : t('bankTransfer.description')}
                    </div>
                }
                onClick={() => setIsOpen(true)}
                chevron
            />
            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                <DrawerContent className="px-4 py-6">
                    <DrawerHeader>
                        <DrawerTitle className="text-start">{title}</DrawerTitle>
                    </DrawerHeader>
                    <div className="max-h-[70vh] overflow-auto">
                        {isLoading && (
                            <div className="flex justify-center py-8">
                                <Loading />
                            </div>
                        )}
                        {!isLoading && isUnavailable && (
                            <p className="py-4 text-body-s text-foreground-secondary">
                                {t('bankTransfer.unavailable')}
                            </p>
                        )}
                        {instructions && (
                            <RequestBankInstructions
                                instructions={instructions}
                                usdAmount={usdAmount}
                                remainingUsd={remainingUsd}
                            />
                        )}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}
