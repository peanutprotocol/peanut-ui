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

    // Firefox iOS uses WebKit but its UI doesn't expose "Add to Home Screen" the
    // way Safari/Chrome iOS do, and the steps differ enough that the Safari video
    // misleads more than it helps. Redirect users to Safari instead.
    const isFirefox = browserType === BrowserType.FIREFOX

    const videoSource = getVideoSource()

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
            content={
                !isFirefox && !isLoading ? (
                    <div className="flex w-full flex-col">
                        <video
                            className="max-h-[60vh] w-full object-contain"
                            autoPlay
                            loop
                            muted
                            playsInline
                            key={videoSource}
                        >
                            {/* The .mov assets are H.264 inside a QuickTime container — every
                                modern browser plays them under the video/mp4 MIME, but most
                                refuse video/quicktime. Keep mp4 first; quicktime is a fallback
                                for older Safari that insists on the exact MIME. */}
                            <source src={videoSource} type="video/mp4" />
                            <source src={videoSource} type="video/quicktime" />
                            Your browser does not support the video tag.
                        </video>
                    </div>
                ) : undefined
            }
        />
    )
}

export default IosPwaInstallModal
