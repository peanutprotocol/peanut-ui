'use client'

import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import Carousel from '@/components/Global/Carousel'
import { useDeviceType, DeviceType } from '@/hooks/useGetDeviceType'
import { useGetBrowserType, BrowserType } from '@/hooks/useGetBrowserType'
import {
    ANDROID_CHROME_1,
    ANDROID_CHROME_2,
    ANDROID_CHROME_3,
    IOS_CHROME_1,
    IOS_CHROME_2,
    IOS_SAFARI_1,
    IOS_SAFARI_2,
    IOS_SAFARI_3,
} from '@/assets/camera-permission'

// ============================================================================
// instruction sets per platform + browser
// ============================================================================

interface Step {
    image: StaticImageData
    labelKey: string
}

const INSTRUCTIONS = {
    android_chrome: [
        { image: ANDROID_CHROME_1, labelKey: 'qrScanner.cameraPermission.androidChrome1' },
        { image: ANDROID_CHROME_2, labelKey: 'qrScanner.cameraPermission.androidChrome2' },
        { image: ANDROID_CHROME_3, labelKey: 'qrScanner.cameraPermission.androidChrome3' },
    ],
    ios_chrome: [
        { image: IOS_CHROME_1, labelKey: 'qrScanner.cameraPermission.iosChrome1' },
        { image: IOS_CHROME_2, labelKey: 'qrScanner.cameraPermission.iosChrome2' },
    ],
    ios_safari: [
        { image: IOS_SAFARI_1, labelKey: 'qrScanner.cameraPermission.iosSafari1' },
        { image: IOS_SAFARI_2, labelKey: 'qrScanner.cameraPermission.iosSafari2' },
        { image: IOS_SAFARI_3, labelKey: 'qrScanner.cameraPermission.iosSafari3' },
    ],
} as const satisfies Record<string, readonly Step[]>

function getInstructionKey(device: DeviceType, browser: BrowserType | null): keyof typeof INSTRUCTIONS | null {
    if (device === DeviceType.ANDROID) return 'android_chrome'
    if (device === DeviceType.IOS) {
        if (browser === BrowserType.SAFARI) return 'ios_safari'
        if (browser === BrowserType.CHROME) return 'ios_chrome'
        return null
    }
    return null
}

// ============================================================================
// component
// ============================================================================

interface CameraPermissionModalProps {
    visible: boolean
    onRetry: () => void
    onClose: () => void
}

export default function CameraPermissionModal({ visible, onRetry, onClose }: CameraPermissionModalProps) {
    const t = useTranslations('global')
    const { deviceType } = useDeviceType()
    const { browserType } = useGetBrowserType()

    const key = getInstructionKey(deviceType, browserType)
    const steps = key ? INSTRUCTIONS[key] : null

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="camera"
            iconContainerClassName="bg-yellow-400"
            iconProps={{ className: 'text-black' }}
            title={t('qrScanner.cameraPermission.title')}
            modalClassName="!z-[60]"
            modalPanelClassName="max-w-md mx-8"
            ctas={[
                {
                    text: t('qrScanner.cameraPermission.tryAgain'),
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: onRetry,
                },
            ]}
            footer={
                <button onClick={onClose} className="text-sm text-grey-1 underline">
                    {t('qrScanner.cameraPermission.dismiss')}
                </button>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <p className="text-sm text-grey-1">
                        {steps
                            ? t('qrScanner.cameraPermission.withStepsHint')
                            : t('qrScanner.cameraPermission.noStepsHint')}
                    </p>

                    {steps && (
                        <Carousel>
                            {steps.map((step, i) => {
                                const label = t(step.labelKey)
                                return (
                                    <div key={i} className="embla__slide flex flex-col items-center gap-2">
                                        <Image
                                            src={step.image}
                                            alt={label}
                                            className="w-full rounded-sm"
                                            placeholder="blur"
                                        />
                                        <p className="text-center text-xs text-grey-1">{label}</p>
                                    </div>
                                )
                            })}
                        </Carousel>
                    )}
                </div>
            }
        />
    )
}
