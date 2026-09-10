'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Notification } from '@/components/0_Bruddle/Notification'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import EvmChainChips from './EvmChainChips'
import { useTranslations } from 'next-intl'

interface SupportedNetworksDrawerProps {
    visible: boolean
    onClose: () => void
}

const SupportedNetworksDrawer = ({ visible, onClose }: SupportedNetworksDrawerProps) => {
    const t = useTranslations('addMoney.supportedNetworksModal')
    return (
        <Drawer
            open={visible}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        {/* same bright-yellow bubble as TokenAndNetworkConfirmationDrawer — the two
                            screens carry the same permanent-loss warning and should read alike */}
                        <IconBubble icon="alert" color="yellow" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                            <DrawerDescription>{t('description')}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        <div className="flex flex-wrap justify-center gap-2">
                            <EvmChainChips />
                        </div>
                        <Notification priority="attention">{t('warning')}</Notification>
                        <Button shadowSize="4" className="w-full justify-center" onClick={onClose}>
                            {t('cta')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default SupportedNetworksDrawer
