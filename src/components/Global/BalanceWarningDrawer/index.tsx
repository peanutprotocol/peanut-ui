'use client'

import { AskShell } from '@/features/attention/AskShell'
import type { InterruptPresentation } from '@/features/attention/types'
import { Callout } from '@/components/0_Bruddle/Callout'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { useMemo } from 'react'
import { useTranslations } from 'next-intl'

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
        // no brand name to show — the label is translated at the render site
        name: null,
        url: 'https://www.passkeys.com/what-are-passkeys',
    },
} as const

interface BalanceWarningDrawerProps {
    presentation?: InterruptPresentation
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

export default function BalanceWarningDrawer({
    visible,
    onCloseAction,
    presentation = 'drawer',
}: BalanceWarningDrawerProps) {
    const t = useTranslations('global')
    const platformInfo = useMemo(() => {
        const platform = detectPlatform()
        return PLATFORM_INFO[platform]
    }, [])
    const platformName = platformInfo.name ?? t('balanceWarningModal.yourDevice')

    // deliberate friction: the only way out is the slide — dismissible={false}
    // makes swipe, overlay tap and hardware back no-ops.
    return (
        <AskShell
            presentation={presentation}
            visible={visible}
            dismissible={false}
            onClose={onCloseAction}
            icon="wallet"
            iconColor="yellow"
            tone="attention"
            title={t('balanceWarningModal.title')}
            description={t('balanceWarningModal.congrats')}
            body={
                <div className="flex w-full flex-col gap-4">
                    <div className="flex w-full flex-col items-start gap-2 text-left">
                        <p className="text-label-m tracking-wide text-foreground-secondary uppercase">
                            {t('balanceWarningModal.goodToKnow')}
                        </p>
                        {/* the two self-custody facts read as a checklist, not flowing prose —
                                same structure the passkey-help surface uses for its fixes */}
                        <Callout
                            priority="info"
                            className="w-full text-left"
                            items={[t('balanceWarningModal.selfCustody'), t('balanceWarningModal.passkey')]}
                        />
                        <p className="text-body-s text-foreground-secondary">
                            {t.rich('balanceWarningModal.learnMore', {
                                platform: platformName,
                                link: (chunks) => (
                                    <a
                                        href={platformInfo.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline"
                                    >
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </p>
                    </div>
                    {/* data-vaul-no-drag: the horizontal slide gesture must not start a drawer drag */}
                    <div className="w-full" data-vaul-no-drag>
                        <SlideToConfirm onConfirm={onCloseAction} label={t('balanceWarningModal.slideToContinue')} />
                    </div>
                </div>
            }
        />
    )
}
