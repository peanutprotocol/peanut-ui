import React from 'react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/0_Bruddle/Button'
import { IconBubble } from '@/components/0_Bruddle/IconBubble'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/components/Global/Drawer'
import { BrowserType, useGetBrowserType } from '@/hooks/useGetBrowserType'
import { useModalsContext } from '@/context/ModalsContext'

const IosPwaInstallModal = () => {
    const t = useTranslations('global')
    const { browserType, isLoading } = useGetBrowserType()
    const { setIsIosPwaInstallModalOpen, isIosPwaInstallModalOpen } = useModalsContext()
    const onClose = () => {
        setIsIosPwaInstallModalOpen(false)
    }

    const getVideoSource = (): string => {
        switch (browserType) {
            case BrowserType.CHROME:
            case BrowserType.EDGE:
            case BrowserType.BRAVE:
            case BrowserType.OPERA:
                return '/iosPwaChrome.mov'
            case BrowserType.SAFARI:
            default:
                return '/iosPwaSafari.mov'
        }
    }

    // Firefox iOS doesn't expose "Add to Home Screen" — redirect to Safari.
    const isFirefox = browserType === BrowserType.FIREFOX
    const videoSource = getVideoSource()

    const videoContent =
        !isFirefox && !isLoading ? (
            <video className="max-h-[50vh] w-full object-contain" autoPlay loop muted playsInline key={videoSource}>
                {/* .mov assets are H.264 in a QuickTime container — Chrome/Edge/Firefox
                    play them under video/mp4 but reject video/quicktime. mp4 first;
                    quicktime stays as a fallback for older Safari. */}
                <source src={videoSource} type="video/mp4" />
                <source src={videoSource} type="video/quicktime" />
                {t('iosPwaInstallModal.videoUnsupported')}
            </video>
        ) : undefined

    return (
        <Drawer
            open={isIosPwaInstallModalOpen}
            onOpenChange={(isOpen) => {
                if (!isOpen) onClose()
            }}
        >
            <DrawerContent>
                <div className="flex flex-col items-center pt-1 pb-6 text-center">
                    {/* the head owns the M/12 beneath it; everything after it
                        keeps the drawer's L/16 rhythm */}
                    <div className="mb-3 flex w-full flex-col items-center gap-4">
                        <IconBubble icon="mobile-install" className="bg-action-primary" />
                        <DrawerHeader className="w-full gap-2 p-0 text-center sm:text-center">
                            <DrawerTitle>{t('iosPwaInstallModal.title')}</DrawerTitle>
                            <DrawerDescription>
                                {isFirefox
                                    ? t('iosPwaInstallModal.firefoxDescription')
                                    : t('iosPwaInstallModal.description')}
                            </DrawerDescription>
                        </DrawerHeader>
                    </div>
                    <div className="flex w-full flex-col items-center gap-4">
                        {videoContent}
                        <Button variant="purple" shadowSize="4" className="w-full justify-center" onClick={onClose}>
                            {t('iosPwaInstallModal.gotItCta')}
                        </Button>
                    </div>
                </div>
            </DrawerContent>
        </Drawer>
    )
}

export default IosPwaInstallModal
