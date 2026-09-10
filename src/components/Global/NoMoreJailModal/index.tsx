'use client'
import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'
import Image from 'next/image'
import PEANUT_LOGO_BLACK from '@/assets/logos/peanut-logo-dark.svg'
import { PEANUTMAN } from '@/assets/mascot'
import { Button } from '@/components/0_Bruddle/Button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { PeanutWhistling } from '@/assets/mascot'

const NoMoreJailModal = () => {
    const t = useTranslations('global')
    const [isOpen, setisOpen] = useState(false)

    const onClose = () => {
        posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, { modal_type: MODAL_TYPES.POST_SIGNUP, cta: 'start_using' })
        setisOpen(false)
        sessionStorage.removeItem('showNoMoreJailModal')
    }

    useEffect(() => {
        const showNoMoreJailModal = sessionStorage.getItem('showNoMoreJailModal')
        if (showNoMoreJailModal === 'true') {
            setisOpen(true)
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.POST_SIGNUP })
        }
    }, [])

    return (
        <Drawer
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the whistling mascot leads the sheet — the celebration IS the content */}
                    <div className="relative h-42 w-[90%] md:h-52">
                        <Image src={PeanutWhistling.src} unoptimized alt="Peanut Man" className="object-contain" fill />
                    </div>
                    <DrawerHeader className="mb-3 w-full gap-2 p-0 text-center sm:text-center">
                        <DrawerTitle>{t('noMoreJailModal.title')}</DrawerTitle>
                        <DrawerDescription>
                            {t('noMoreJailModal.line1')}
                            <br />
                            {t('noMoreJailModal.line2')}
                        </DrawerDescription>
                    </DrawerHeader>
                    <Button variant="purple" shadowSize="4" className="w-full justify-center gap-2" onClick={onClose}>
                        <div>{t('noMoreJailModal.startUsingCta')}</div>
                        <div className="flex items-center gap-1">
                            <Image src={PEANUTMAN} alt="Peanut Logo" className="size-5" />
                            <Image src={PEANUT_LOGO_BLACK} alt="Peanut Logo" />
                        </div>
                    </Button>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default NoMoreJailModal
