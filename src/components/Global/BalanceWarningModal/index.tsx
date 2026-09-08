'use client'

import ActionModal from '@/components/Global/ActionModal'
import { Notification } from '@/components/0_Bruddle/Notification'
import SlideToConfirm from '@/components/0_Bruddle/SlideToConfirm'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslations } from 'next-intl'
import posthog from 'posthog-js'
import { ANALYTICS_EVENTS, MODAL_TYPES } from '@/constants/analytics.consts'

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
    const t = useTranslations('global')
    const platformInfo = useMemo(() => {
        const platform = detectPlatform()
        return PLATFORM_INFO[platform]
    }, [])
    const platformName = platformInfo.name ?? t('balanceWarningModal.yourDevice')

    const hasTrackedShow = useRef(false)
    useEffect(() => {
        if (visible && !hasTrackedShow.current) {
            hasTrackedShow.current = true
            posthog.capture(ANALYTICS_EVENTS.MODAL_SHOWN, { modal_type: MODAL_TYPES.BALANCE_WARNING })
        }
    }, [visible])
    // deliberate friction: the only way out is the slide — preventClose and the
    // hidden close button make the overlay tap and the X no-ops.
    return (
        <ActionModal
            visible={visible}
            onClose={onCloseAction}
            preventClose
            hideModalCloseButton
            // this is good news, not an alert — pink wallet, not the yellow warning tone
            icon="wallet"
            iconContainerClassName="bg-action-primary"
            iconProps={{ className: 'text-black' }}
            title={t('balanceWarningModal.title')}
            description={t('balanceWarningModal.congrats')}
            ctas={[]}
            content={
                <div className="flex w-full flex-col items-start gap-2 text-left">
                    <p className="text-label-m tracking-wide text-foreground-secondary uppercase">
                        {t('balanceWarningModal.goodToKnow')}
                    </p>
                    {/* the two self-custody facts read as a checklist, not flowing prose —
                        same structure the passkey-help surface uses for its fixes */}
                    <Notification
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
            }
            footer={
                <div className="w-full">
                    <SlideToConfirm
                        onConfirm={() => {
                            posthog.capture(ANALYTICS_EVENTS.MODAL_CTA_CLICKED, {
                                modal_type: MODAL_TYPES.BALANCE_WARNING,
                                cta: 'slide_to_continue',
                            })
                            onCloseAction()
                        }}
                        label={t('balanceWarningModal.slideToContinue')}
                    />
                </div>
            }
        />
    )
}
