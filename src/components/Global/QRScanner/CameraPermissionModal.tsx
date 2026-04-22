'use client'

import Image from 'next/image'
import type { StaticImageData } from 'next/image'
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
    label: string
}

const INSTRUCTIONS: Record<string, Step[]> = {
    android_chrome: [
        { image: ANDROID_CHROME_1, label: 'Step 1: tap the lock icon in the address bar' },
        { image: ANDROID_CHROME_2, label: 'Step 2: tap "Permissions"' },
        { image: ANDROID_CHROME_3, label: 'Step 3: enable Camera' },
    ],
    ios_chrome: [
        { image: IOS_CHROME_1, label: 'Step 1: open Settings → Chrome' },
        { image: IOS_CHROME_2, label: 'Step 2: enable Camera' },
    ],
    ios_safari: [
        { image: IOS_SAFARI_1, label: 'Step 1: tap "aA" in the address bar' },
        { image: IOS_SAFARI_2, label: 'Step 2: tap "Website Settings"' },
        { image: IOS_SAFARI_3, label: 'Step 3: set Camera to "Allow"' },
    ],
}

function getInstructionKey(device: DeviceType, browser: BrowserType | null): string | null {
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
            title="Camera access needed"
            modalClassName="!z-[60]"
            modalPanelClassName="max-w-md mx-8"
            ctas={[{ text: 'Try again', variant: 'purple', shadowSize: '4', onClick: onRetry }]}
            footer={
                <button onClick={onClose} className="text-sm text-grey-1 underline">
                    Dismiss
                </button>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <p className="text-sm text-grey-1">
                        {steps
                            ? 'Follow these steps to enable camera access, then try again.'
                            : 'Please enable camera access in your browser or device settings, then try again.'}
                    </p>

                    {steps && (
                        <Carousel>
                            {steps.map((step, i) => (
                                <div key={i} className="embla__slide flex flex-col items-center gap-2">
                                    <Image
                                        src={step.image}
                                        alt={step.label}
                                        className="w-full rounded-sm"
                                        placeholder="blur"
                                    />
                                    <p className="text-center text-xs text-grey-1">{step.label}</p>
                                </div>
                            ))}
                        </Carousel>
                    )}
                </div>
            }
        />
    )
}
