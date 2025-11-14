'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import Modal from '@/components/Global/Modal'
import { useMemo } from 'react'
import { Slider } from '@/components/Slider'

enum Platform {
    IOS = 'ios',
    ANDROID = 'android',
    MACOS = 'macos',
    WINDOWS = 'windows',
    UNKNOWN = 'unknown',
}

const PLATFORM_INFO = {
    [Platform.IOS]: {
        name: 'iPhone/iPad',
        url: 'https://support.apple.com/en-us/102195',
    },
    [Platform.ANDROID]: {
        name: 'Android',
        url: 'https://support.google.com/accounts/answer/6197437',
    },
    [Platform.MACOS]: {
        name: 'Mac',
        url: 'https://support.apple.com/en-us/102195',
    },
    [Platform.WINDOWS]: {
        name: 'Windows',
        url: 'https://support.microsoft.com/en-us/windows/passkeys-in-windows-301c8944-5ea2-452b-9886-97e4d2ef4422',
    },
    [Platform.UNKNOWN]: {
        name: 'your device',
        url: 'https://www.passkeys.com/what-are-passkeys',
    },
} as const

interface BalanceWarningModalProps {
    visible: boolean
    onCloseAction: () => void
}

function detectPlatform(): Platform {
    if (typeof window === 'undefined') return Platform.UNKNOWN

    const userAgent = navigator.userAgent.toLowerCase()

    // iOS detection (including iPad on iOS 13+)
    if (/ipad|iphone|ipod/.test(userAgent) || (navigator.maxTouchPoints > 1 && /mac/.test(userAgent))) {
        return Platform.IOS
    }

    // Android detection
    if (/android/.test(userAgent)) {
        return Platform.ANDROID
    }

    // macOS detection
    if (/mac/.test(userAgent) && !/ipad|iphone|ipod/.test(userAgent)) {
        return Platform.MACOS
    }

    // Windows detection
    if (/windows|win32|win64/.test(userAgent)) {
        return Platform.WINDOWS
    }

    return Platform.UNKNOWN
}

export default function BalanceWarningModal({ visible, onCloseAction }: BalanceWarningModalProps) {
    const platformInfo = useMemo(() => {
        const platform = detectPlatform()
        return PLATFORM_INFO[platform]
    }, [])
    return (
        <Modal
            visible={visible}
            onClose={() => {}}
            preventClose={true}
            hideOverlay={true}
            className="z-50 !items-center !justify-center !px-6"
            classWrap="!self-center !bottom-auto !mx-auto !w-auto !max-w-md"
        >
            <div className="flex w-full flex-col items-center justify-center gap-6 p-6 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-yellow-400">
                    <Icon name="alert" className="size-8" />
                </div>

                <div className="space-y-4">
                    <h2 className="text-xl font-bold">High Balance</h2>
                    <div className="space-y-3 text-sm text-gray-600">
                        <p>You're rich! Congrats on having a high balance.</p>
                        <p>
                            With Peanut, you're the only one who can access your funds. No bank, no company, no agency —
                            not even our support team — can ever access them.
                        </p>
                        <p>
                            Your biometric passkey is your key to full control and security. If it's lost, it can't be
                            recovered because only you ever have access.
                        </p>

                        {platformInfo && (
                            <>
                                Learn how to keep your passkey secure on{' '}
                                <a
                                    href={platformInfo.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 underline"
                                >
                                    {platformInfo.name}
                                </a>
                                .
                            </>
                        )}
                    </div>
                </div>

                <Slider onAccepted={onCloseAction} title="Slide to Continue" />
            </div>
        </Modal>
    )
}
