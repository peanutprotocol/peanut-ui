'use client'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/Global/Drawer/index'
import { Button } from '@/components/0_Bruddle/Button'
import { Card } from '@/components/0_Bruddle/Card'
import QRCodeWrapper from '@/components/Global/QRCodeWrapper'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'
import type { CurrencyAccount } from '@/services/currency-accounts'

export function EurcReceiveView({ account, onClose }: { account: CurrencyAccount; onClose: () => void }) {
    const t = useAppTranslations('currencyAccounts')
    return (
        <Drawer
            open
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
            hideBottomNav
        >
            <DrawerContent>
                <div className="flex flex-col gap-4 pb-4">
                    <DrawerTitle>{t('receive')}</DrawerTitle>
                    <p>{t('receiveWarning')}</p>
                    <Card className="gap-3 p-4">
                        <QRCodeWrapper
                            url={`ethereum:${account.tokenAddress}@8453/transfer?address=${account.address}`}
                        />
                        <p className="text-body-s break-all">{account.address}</p>
                    </Card>
                    <Button onClick={onClose}>{t('back')}</Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
