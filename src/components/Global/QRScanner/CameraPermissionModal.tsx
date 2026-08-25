'use client'

import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
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
    // Pasting a code is a camera-free way to pay, so it stays offered here
    onPaste?: () => void
}

export default function CameraPermissionModal({ visible, onRetry, onClose, onPaste }: CameraPermissionModalProps) {
    const t = useTranslations('global')
    const tCommon = useTranslations('common')
    const { deviceType } = useDeviceType()
    const { browserType } = useGetBrowserType()

    const key = getInstructionKey(deviceType, browserType)
    const steps = key ? INSTRUCTIONS[key] : null

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="camera"
            iconContainerClassName=""
            iconProps={{ className: 'text-foreground-primary' }}
            title={t('qrScanner.cameraPermission.title')}
            modalClassName="!z-[60]"
            modalPanelClassName="max-w-md mx-8"
            ctas={[
                {
                    text: tCommon('tryAgain'),
                    variant: 'purple',
                    shadowSize: '4',
                    onClick: onRetry,
                },
                ...(onPaste
                    ? [
                          {
                              text: t('qrScanner.clickToPaste'),
                              variant: 'primary-soft' as const,
                              shadowSize: '4' as const,
                              onClick: onPaste,
                          },
                      ]
                    : []),
            ]}
            footer={<LinkButton onClick={onClose}>{t('qrScanner.cameraPermission.dismiss')}</LinkButton>}
            content={
                <div className="flex w-full flex-col gap-4">
                    <p className="text-body-s text-foreground-secondary">
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
                                        <p className="text-center text-body-xs text-foreground-secondary">{label}</p>
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
