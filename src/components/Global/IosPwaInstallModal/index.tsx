import React from 'react'

import ActionModal from '../ActionModal'
import { BrowserType, useGetBrowserType } from '@/hooks/useGetBrowserType'
import { useModalsContext } from '@/context/ModalsContext'

const IosPwaInstallModal = () => {
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
                Your browser does not support the video tag.
            </video>
        ) : undefined

    return (
        <ActionModal
            visible={isIosPwaInstallModalOpen}
            onClose={onClose}
            title="Add Peanut to your Home Screen"
            description={
                isFirefox
                    ? 'Firefox on iOS does not support installing apps to the home screen. Please open this page in Safari to continue.'
                    : 'Follow a quick guide to add the app to your home screen, no download needed.'
            }
            icon="mobile-install"
            ctas={[
                {
                    text: 'Got it!',
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
