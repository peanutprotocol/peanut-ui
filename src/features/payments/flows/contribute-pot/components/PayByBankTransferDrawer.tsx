'use client'

import { ListItem } from '@/components/0_Bruddle/ListItem'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import Loading from '@/components/Global/Loading'
import { RequestBankInstructions } from '@/features/deposit-accounts/components/RequestBankInstructions'
import { useRequestDepositInstructions } from '@/features/deposit-accounts/useRequestDepositInstructions'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

/**
 * Pay this request straight into the requester's bank account.
 *
 * Only offered when the requester opted in, and the details are fetched when
 * the payer opens the drawer rather than with the screen: bank details are not
 * something to load into a page the payer may never ask for. They are never on
 * the username page for the same reason — a request link is a thing somebody
 * was given, a public profile is not.
 */
export function PayByBankTransferDrawer({ requestId, bankPayable }: { requestId: string; bankPayable: boolean }) {
    const t = useTranslations('payment')
    const [isOpen, setIsOpen] = useState(false)
    const { instructions, isLoading, isUnavailable } = useRequestDepositInstructions(requestId, bankPayable && isOpen)

    if (!bankPayable) return null

    return (
        <>
            <ListItem
                position="single"
                title={t('bankTransfer.title')}
                body={<div className="text-body-xs">{t('bankTransfer.description')}</div>}
                onClick={() => setIsOpen(true)}
                chevron
            />
            <Drawer open={isOpen} onOpenChange={setIsOpen}>
                <DrawerContent className="px-4 py-6">
                    <DrawerHeader>
                        <DrawerTitle className="text-start">{t('bankTransfer.title')}</DrawerTitle>
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
                        {instructions && <RequestBankInstructions instructions={instructions} />}
                    </div>
                </DrawerContent>
            </Drawer>
        </>
    )
}
