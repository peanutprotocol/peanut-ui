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

    const videoSource = getVideoSource()

    return (
        <ActionModal
            visible={isIosPwaInstallModalOpen}
            onClose={onClose}
            title="Add Peanut to your Home Screen"
            description="Follow a quick guide to add the app to your home screen, no download needed."
            icon="mobile-install"
            content={
                <div className="flex w-full flex-col">
                    {!isLoading && (
                        <video
                            className="max-h-[60vh] w-full object-contain"
                            autoPlay
                            loop
                            muted
                            playsInline
                            key={videoSource}
                        >
                            <source src={videoSource} type="video/quicktime" />
                            Your browser does not support the video tag.
                        </video>
                    )}
                </div>
            }
        />
    )
}

export default IosPwaInstallModal
