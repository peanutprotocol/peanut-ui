'use client'

import { Button } from '@/components/0_Bruddle/Button'
import { CONCEPT_ICONS } from '@/components/0_Bruddle/conceptIcons'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { ANALYTICS_EVENTS } from '@/constants/analytics.consts'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import posthog from 'posthog-js'
import { useEffect } from 'react'

/**
 * The first-payment chooser for a user the card is open to: pay with the card
 * or scan a QR. Both are a spend, and a spend is what activates.
 */
export default function FirstPaymentChooser({ open, onClose }: { open: boolean; onClose: () => void }) {
    const t = useTranslations('home.activation.spendChooser')
    const router = useRouter()
    const { setIsQRScannerOpen } = useModalsContext()

    useEffect(() => {
        if (open) posthog.capture(ANALYTICS_EVENTS.ACTIVATION_SPEND_CHOOSER_SHOWN)
    }, [open])

    const choose = (choice: 'card' | 'qr') => {
        posthog.capture(ANALYTICS_EVENTS.ACTIVATION_SPEND_CHOOSER_SELECTED, { choice })
        onClose()
        if (choice === 'card') router.push('/card')
        else setIsQRScannerOpen(true)
    }

    return (
        <Drawer
            open={open}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble {...CONCEPT_ICONS.card} />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('title')}</DrawerTitle>
                            <DrawerDescription>{t('description')}</DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        <Button shadowSize="4" className="w-full justify-center" onClick={() => choose('card')}>
                            {t('payWithCard')}
                        </Button>
                        <Button variant="secondary" className="w-full justify-center" onClick={() => choose('qr')}>
                            {t('scanQr')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}
