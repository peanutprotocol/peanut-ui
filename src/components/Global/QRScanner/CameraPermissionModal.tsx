'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import type { StaticImageData } from 'next/image'
import { useTranslations } from 'next-intl'
import ActionModal from '@/components/Global/ActionModal'
import { Button } from '@/components/0_Bruddle/Button'
import Carousel from '@/components/Global/Carousel'
import { useDeviceType, DeviceType } from '@/hooks/useGetDeviceType'
import { useGetBrowserType, BrowserType } from '@/hooks/useGetBrowserType'
import { isAndroidNativeBridge, isNativeBridge } from '@/utils/capacitor'
import { canOpenAppSettings, openAppSettings } from '@/utils/native-settings'
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

/*
 * Native has no browser chrome, so every screenshot above is wrong there: the
 * camera grant is an OS permission on the app, reachable only through Settings.
 * Text steps carry it instead — the deep link lands the user on the app's own
 * settings page, so there is nothing left worth screenshotting.
 */
const NATIVE_STEPS = {
    ios: ['qrScanner.cameraPermission.native.step1', 'qrScanner.cameraPermission.native.iosStep2'],
    android: [
        'qrScanner.cameraPermission.native.step1',
        'qrScanner.cameraPermission.native.androidStep2',
        'qrScanner.cameraPermission.native.androidStep3',
    ],
} as const satisfies Record<string, readonly string[]>

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
    const tCommon = useTranslations('common')
    const { deviceType } = useDeviceType()
    const { browserType } = useGetBrowserType()

    const isNative = isNativeBridge()
    const canDeepLinkToSettings = isNative && canOpenAppSettings()

    const key = isNative ? null : getInstructionKey(deviceType, browserType)
    const steps = key ? INSTRUCTIONS[key] : null
    // the bridge names the platform outright, so native copy does not ride on
    // the user-agent sniff the browser instructions have to fall back to
    const nativeStepKeys = isNative ? (isAndroidNativeBridge() ? NATIVE_STEPS.android : NATIVE_STEPS.ios) : null

    const onRetryRef = useRef(onRetry)
    onRetryRef.current = onRetry

    /*
     * Changing a permission in Settings terminates the app on both OSes, so
     * this only catches the user who came back having changed nothing — but
     * without it that user is staring at a modal whose only button sends them
     * back to Settings again.
     */
    useEffect(() => {
        if (!visible || !canDeepLinkToSettings) return
        let cancelled = false
        let remove: (() => void) | undefined
        import('@capacitor/app')
            .then(({ App }) =>
                App.addListener('appStateChange', ({ isActive }) => {
                    if (isActive) onRetryRef.current()
                })
            )
            .then((handle) => {
                if (cancelled) handle.remove()
                else remove = () => handle.remove()
            })
            .catch(() => {})
        return () => {
            cancelled = true
            remove?.()
        }
    }, [visible, canDeepLinkToSettings])

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            icon="camera"
            iconContainerClassName="bg-action-secondary"
            iconProps={{ className: 'text-foreground-primary' }}
            title={t('qrScanner.cameraPermission.title')}
            modalClassName="!z-[60]"
            modalPanelClassName="max-w-md mx-8"
            // one primary + one secondary (Dismiss, in the footer) — the old
            // paste CTA made two secondaries, off the modal recipe (ruled
            // 2026-09-03, kush). trade-off accepted: a camera-denied native
            // user loses the paste entry on this screen
            ctas={[
                canDeepLinkToSettings
                    ? {
                          text: t('qrScanner.cameraPermission.native.openSettings'),
                          variant: 'purple' as const,
                          shadowSize: '4' as const,
                          onClick: () => {
                              void openAppSettings()
                          },
                      }
                    : {
                          text: tCommon('tryAgain'),
                          variant: 'purple' as const,
                          shadowSize: '4' as const,
                          onClick: onRetry,
                      },
            ]}
            footer={
                <Button variant="stroke" className="w-full" onClick={onClose}>
                    {t('qrScanner.cameraPermission.dismiss')}
                </Button>
            }
            content={
                <div className="flex w-full flex-col gap-4">
                    <p className="text-body-s text-foreground-secondary">
                        {nativeStepKeys
                            ? t('qrScanner.cameraPermission.native.hint')
                            : steps
                              ? t('qrScanner.cameraPermission.withStepsHint')
                              : t('qrScanner.cameraPermission.noStepsHint')}
                    </p>

                    {nativeStepKeys && (
                        <ol className="flex flex-col gap-2">
                            {nativeStepKeys.map((stepKey, i) => (
                                <li key={stepKey} className="flex gap-2 text-body-s text-foreground-secondary">
                                    <span className="text-foreground-primary">{i + 1}.</span>
                                    <span>{t(stepKey)}</span>
                                </li>
                            ))}
                        </ol>
                    )}

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
