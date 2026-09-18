'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { RequestBankInstructions } from '@/features/deposit-accounts/components/RequestBankInstructions'
import { DEPOSIT_RAILS, corridorFromRailId } from '@/features/deposit-accounts/rails'
import { useDepositAccountCopy } from '@/features/deposit-accounts/useDepositAccountCopy'
import type { RequestDepositInstructions } from '@/services/services.types'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/**
 * One currency-led way to pay a request by bank, for a signed-out payer.
 *
 * The row leads with the currency and the rail — "Pay in EUR · SEPA" — because
 * a business reading a payment link knows its own currency before it knows
 * "bank transfer": the label it recognises is the one that matches the account
 * it would send from. The currency and the rail name are the corridor's own,
 * read through the same catalog the account holder's screens use, so the payer
 * and the requester never see the corridor named two ways.
 *
 * Tapping it opens the details in the SAME `RequestBankInstructions` the app
 * shows a signed-in payer — account holder, IBAN/CLABE/sort code, the amount
 * in the account's currency, and the reference the deposit must carry.
 */
export function CurrencyBankOption({
    instructions,
    usdAmount,
}: {
    instructions: RequestDepositInstructions
    /** what the request asks for, in dollars, so the amount reads in the account's currency */
    usdAmount?: string
}) {
    const t = useTranslations('payment')
    const { railName } = useDepositAccountCopy()
    const [isOpen, setIsOpen] = useState(false)

    const account = instructions.depositAccount
    const corridor = corridorFromRailId(account.railId)
    // The corridor is the source of both halves of the label. A railId we can't
    // map is not expected — the backend builds it as `${provider}.${method}` —
    // so fall back to the plain "pay by bank transfer" title rather than print a
    // half-built label.
    const currency = (corridor ? DEPOSIT_RAILS[corridor].currency : account.currency).toUpperCase()
    const title = corridor
        ? t('bankTransfer.payInCurrency', { currency, rail: railName(corridor) })
        : t('bankTransfer.title')

    return (
        <>
            <ListItem
                position="single"
                title={title}
                body={<div className="text-body-xs">{t('bankTransfer.description')}</div>}
                onClick={() => setIsOpen(true)}
                chevron
                data-testid="currency-bank-option"
            />
            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                <DrawerContent className="py-6">
                    <DrawerHeader>
                        <DrawerTitle className="text-start">{title}</DrawerTitle>
                    </DrawerHeader>
                    <RequestBankInstructions instructions={instructions} usdAmount={usdAmount} />
                </DrawerContent>
            </Drawer>
        </>
    )
}
