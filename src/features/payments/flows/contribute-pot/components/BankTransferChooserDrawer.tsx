'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import type { RequestPayRail } from '@/services/services.types'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { PayByBankTransferDrawer } from './PayByBankTransferDrawer'
import { RequestPaymentContext } from './RequestPaymentContext'
import { getCardPosition } from '@/components/Global/Card/card.utils'

export function BankTransferChooserDrawer({
    requestId,
    rails,
    recipientUsername,
    recipientAvatarKey,
    requestMessage,
    requestAmount,
    bankRowProps,
    onUnavailable,
}: {
    requestId: string
    rails: RequestPayRail[]
    recipientUsername?: string
    recipientAvatarKey?: string | null
    requestMessage?: string
    requestAmount?: string
    bankRowProps: {
        bankPayable: boolean
        usdAmount?: string
        remainingUsd?: number
        serverCountsAllPayments?: boolean
    }
    onUnavailable: (rail: RequestPayRail) => void
}) {
    const t = useTranslations('payment.bankTransfer')
    const [isOpen, setIsOpen] = useState(false)

    return (
        <>
            <ListItem
                position="solo"
                title={t('title')}
                body={t('description')}
                // the payer reads this line to choose; at 375px it was cut in every locale
                bodyWrap
                onClick={() => setIsOpen(true)}
                chevron
                data-testid="bank-transfer-chooser"
            />
            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                <DrawerContent>
                    <DrawerHeader>
                        <DrawerTitle className="text-start">{t('chooseCurrency')}</DrawerTitle>
                    </DrawerHeader>
                    <RequestPaymentContext
                        {...{ recipientUsername, recipientAvatarKey, requestMessage, requestAmount }}
                    />
                    <div className="pb-4">
                        {rails.map((rail, index) => (
                            <PayByBankTransferDrawer
                                key={rail.railId ?? rail.payerAmount.currency}
                                requestId={requestId}
                                rail={rail}
                                nested
                                position={getCardPosition(index, rails.length)}
                                requestContext={{
                                    recipientUsername,
                                    recipientAvatarKey,
                                    requestMessage,
                                    requestAmount,
                                }}
                                onUnavailable={() => onUnavailable(rail)}
                                {...bankRowProps}
                            />
                        ))}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}
