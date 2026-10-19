'use client'

import { DataRow } from '@/components/0_Bruddle/DataRow'
import { Section } from '@/components/0_Bruddle/Section'
import Card from '@/components/Global/Card'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { Icon } from '@/components/Global/Icons/Icon'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { corridorFromRailId } from '../rails'
import { SKELETON_PULSE } from '../skeleton'
import { useDepositAccountCopy } from '../useDepositAccountCopy'
import { useRequestDepositInstructions } from '../useRequestDepositInstructions'
import { RequestBankInstructions } from './RequestBankInstructions'
import { RequestShareActions } from './RequestShareActions'

const CARD_CLASS = 'divide-y divide-dashed divide-border-default px-4 py-0'

/**
 * What the payer of one request is told to pay by bank transfer, shown to the
 * requester: the reference, and the full details behind one tap.
 *
 * It reads the same public route the payer reads, so the requester sees the
 * account, amount and reference the payer sees. A paid or closed request
 * answers 404 there, and the card then renders nothing.
 */
export function RequestBankTransferCard({
    requestId,
    title,
    nested = false,
    canShare = false,
    onOpenChange,
}: {
    requestId: string
    /** section heading; inside the card so a request with no details leaves no empty heading */
    title?: string
    /** set inside another drawer (the Activity receipt): the details open as a vaul NestedRoot */
    nested?: boolean
    canShare?: boolean
    /** the parent drawer stays open while this one is, so it needs to know */
    onOpenChange?: (open: boolean) => void
}) {
    const t = useTranslations('payment')
    const { t: tDeposit, railName } = useDepositAccountCopy()
    const [isOpen, setIsOpen] = useState(false)
    const { instructions, isLoading } = useRequestDepositInstructions(requestId, true)

    const setOpen = (open: boolean) => {
        setIsOpen(open)
        onOpenChange?.(open)
    }

    if (isLoading) {
        return (
            <Section title={title}>
                <Card position="solo" className={CARD_CLASS}>
                    {[0, 1].map((row) => (
                        <div key={row} className="flex items-center justify-between py-3">
                            <div aria-hidden className={`h-4 w-28 ${SKELETON_PULSE}`} />
                            <div aria-hidden className={`h-4 w-20 ${SKELETON_PULSE}`} />
                        </div>
                    ))}
                </Card>
            </Section>
        )
    }
    if (!instructions) return null

    const currency = instructions.depositAccount.currency.toUpperCase()
    const corridor = corridorFromRailId(instructions.depositAccount.railId)
    // A Bre-B account is credited on the provider's own deposit message, and a
    // bank form has one reference field. Share text that adds the request's
    // reference beside it tells the payer two things to type into one box, so
    // such an account gets no request share text until the provider confirms
    // a combined reference.
    const shareable = canShare && !instructions.depositAccount.instructions?.depositMessage
    const drawerTitle = corridor
        ? t('bankTransfer.payInCurrency', { currency, rail: railName(corridor) })
        : tDeposit('title')

    return (
        <Section title={title}>
            <Card position="solo" className={CARD_CLASS}>
                <DataRow
                    label={t('bankTransfer.referenceLabel')}
                    value={instructions.paymentReference}
                    allowCopy={true}
                />
                <DataRow
                    label={tDeposit('title')}
                    value={corridor ? `${currency} · ${railName(corridor)}` : currency}
                    onClick={() => setOpen(true)}
                    trailing={<Icon name="chevron-right" size={20} />}
                />
            </Card>
            <Drawer open={isOpen} onOpenChange={setOpen} nested={nested}>
                <DrawerContent className="py-6">
                    <DrawerHeader>
                        <DrawerTitle className="text-start">{drawerTitle}</DrawerTitle>
                    </DrawerHeader>
                    <div className="flex flex-col gap-6">
                        <RequestBankInstructions instructions={instructions} />
                        {shareable && <RequestShareActions instructions={instructions} currency={currency} />}
                    </div>
                </DrawerContent>
            </Drawer>
        </Section>
    )
}
