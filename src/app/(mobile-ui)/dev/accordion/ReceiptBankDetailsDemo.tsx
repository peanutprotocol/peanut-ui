'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Accordion } from '@/components/0_Bruddle/Accordion'
import { DataRow } from '@/components/0_Bruddle/DataRow'
import Card from '@/components/Global/Card'
import CopyToClipboard from '@/components/Global/CopyToClipboard'
import MoreInfo from '@/components/Global/MoreInfo'
import { BridgeDepositInstructions } from '@/components/TransactionDetails/provider-rows/BridgeDepositInstructions'
import { receiptDataRowCardClassName } from '@/components/TransactionDetails/receipt-data-row-layout'
import {
    type DrawerDepositInstructions,
    type TransactionDetails,
} from '@/components/TransactionDetails/transactionTransformer'
import { resolveBridgeAccountHolderName } from '@/constants/payment.consts'
import { shortDepositReference } from '@/utils/format.utils'
import { formatIban } from '@/utils/general.utils'

// a SEPA deposit's instructions, in the shape Bridge returns them
const INSTRUCTIONS: DrawerDepositInstructions = {
    amount: '250.00',
    currency: 'eur',
    payment_rail: 'sepa',
    deposit_message: 'BRGXQ7K2M9D4TPLA',
    account_holder_name: 'Bridge Building Sp. Z.o.o.',
    bank_name: 'Banking Circle S.A.',
    bank_address: '2 Boulevard de la Foire, L-1528 Luxembourg',
    iban: 'LU904080000041265803',
    bic: 'BCIRLULL',
}

const TRANSACTION = { extraDataForDrawer: { depositInstructions: INSTRUCTIONS } } as unknown as TransactionDetails

const copyValue = (value: string) => (
    <div className="flex items-center gap-2">
        <span>{value}</span>
        <CopyToClipboard textToCopy={value} iconSize="4" />
    </div>
)

/**
 * Receipt bank details (BridgeDepositInstructions). Before: the real
 * component, an underlined button with a rotating chevron-up and no
 * aria-expanded. After: Accordion variant="link" with flush content, so the
 * rows keep the receipt card's dashed dividers.
 */
export function ReceiptBankDetailsDemo({ mode }: { mode: 'before' | 'after' }) {
    const t = useTranslations('transaction')
    const [open, setOpen] = useState('')

    if (mode === 'before') {
        return (
            <Card className={receiptDataRowCardClassName}>
                <BridgeDepositInstructions transaction={TRANSACTION} />
            </Card>
        )
    }

    return (
        <Card className={receiptDataRowCardClassName}>
            <DataRow
                label={
                    <div className="flex items-center gap-1">
                        <span>{t('bridge.depositMessage')}</span>
                        <MoreInfo text={t('bridge.depositMessageInfo')} />
                    </div>
                }
                value={copyValue(shortDepositReference(INSTRUCTIONS.deposit_message))}
            />
            <Accordion type="single" collapsible variant="link" value={open} onValueChange={setOpen}>
                <Accordion.Item value="bank">
                    <Accordion.Trigger>
                        {open ? t('bridge.hideBankDetails') : t('bridge.seeBankDetails')}
                    </Accordion.Trigger>
                    {/* the rows sit one level down now, so the content repeats
                        the card's dashed dividers; the other rail branches
                        (CLABE, UK, US) move in unchanged */}
                    <Accordion.Content
                        flush
                        className="divide-y divide-dashed divide-border-default border-t border-dashed border-border-default"
                    >
                        <DataRow
                            label={t('bridge.accountHolderName')}
                            value={resolveBridgeAccountHolderName(INSTRUCTIONS.account_holder_name)}
                            allowCopy
                        />
                        <DataRow label={t('bridge.bankName')} value={copyValue(INSTRUCTIONS.bank_name)} />
                        <DataRow label={t('bridge.bankAddress')} value={copyValue(INSTRUCTIONS.bank_address!)} />
                        <DataRow label="IBAN" value={copyValue(formatIban(INSTRUCTIONS.iban!))} />
                        <DataRow label="BIC" value={copyValue(INSTRUCTIONS.bic!)} />
                    </Accordion.Content>
                </Accordion.Item>
            </Accordion>
        </Card>
    )
}
