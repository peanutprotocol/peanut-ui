'use client'

import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription } from '@/components/Global/Drawer'
import NetworkList from './NetworkList'
import type { RhinoChainType } from '@/services/services.types'
import { useTranslations } from 'next-intl'

interface ChooseNetworkDrawerProps {
    open: boolean
    onClose: () => void
    onSelect: (network: RhinoChainType) => void
}

/** drawer shell around the shared NetworkList (F-22: one list, two shells). */
const ChooseNetworkDrawer = ({ open, onClose, onSelect }: ChooseNetworkDrawerProps) => {
    const t = useTranslations('addMoney.networkDrawer')
    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DrawerContent className="pt-4">
                <DrawerHeader className="pt-0 text-center">
                    <DrawerTitle className="font-bold text-foreground-primary">{t('title')}</DrawerTitle>
                    <DrawerDescription>{t('description')}</DrawerDescription>
                </DrawerHeader>
                <div className="flex flex-col px-4 pb-6">
                    <NetworkList onSelect={onSelect} showEvmChips />
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default ChooseNetworkDrawer
