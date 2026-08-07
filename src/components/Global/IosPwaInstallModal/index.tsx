import React from 'react'
import { useTranslations } from 'next-intl'

import ActionModal from '../ActionModal'
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
            <video className="max-h-[60vh] w-full object-contain" autoPlay loop muted playsInline key={videoSource}>
                {/* .mov assets are H.264 in a QuickTime container — Chrome/Edge/Firefox
                    play them under video/mp4 but reject video/quicktime. mp4 first;
                    quicktime stays as a fallback for older Safari. */}
                <source src={videoSource} type="video/mp4" />
                <source src={videoSource} type="video/quicktime" />
                {t('iosPwaInstallModal.videoUnsupported')}
            </video>
        ) : undefined

    return (
        <ActionModal
            visible={isIosPwaInstallModalOpen}
            onClose={onClose}
            title={t('iosPwaInstallModal.title')}
            description={isFirefox ? t('iosPwaInstallModal.firefoxDescription') : t('iosPwaInstallModal.description')}
            icon="mobile-install"
            ctas={[
                {
                    text: t('iosPwaInstallModal.gotItCta'),
                    onClick: onClose,
                    shadowSize: '4',
                    variant: 'purple',
                },
            ]}
            content={videoContent}
        />
    )
}

export default IosPwaInstallModal
