'use client'

import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useToast } from '@/components/0_Bruddle/Toast'
import { type IconName } from '@/components/Global/Icons/Icon'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { useEffect, useState, Suspense, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { usePasskeySupportContext } from '@/context/passkeySupportContext'

export const inAppSignatures = [
    // removed 'WebView' and 'Android.*wv' — too broad, matches capacitor's webview
    // specific app signatures below catch the actual problem apps
    '(iPhone|iPod|iPad)(?!.*Safari\\/)', // iOS WebView (non-safari)
    'FBAN', // Facebook App
    'FBAV', // Facebook App
    'Instagram', // Instagram App
    'Twitter', // Twitter App
    'Snapchat', // Snapchat App
    'Line', // LINE App
    'WhatsApp', // WhatsApp
    'WeChat', // WeChat
    'TelegramBot', // Telegram bot WebView
    'Telegram', // Telegram in-app
    'TelegramWebApp', // Telegram Web App
    'Puffin', // Puffin browser (non-standard)
    'Discord', // Discord in-app browser
    'TikTok', // TikTok App
    'Messenger', // Facebook Messenger
    'Viber', // Viber App
    'Reddit', // Reddit App
    'Pinterest', // Pinterest App
    'LinkedInApp', // LinkedIn in-app
    'SnapKit', // Snapchat Kit
    'Instagram 100.', // Instagram WebView variant
    'Electron', // Electron App
]

const UnsupportedBrowserModalContent = ({
    allowClose = true,
    visible = false,
}: {
    allowClose?: boolean
    visible?: boolean
}) => {
    const t = useTranslations('global')
    const searchParams = useSearchParams()
    const [showInAppBrowserModalViaDetection, setShowInAppBrowserModalViaDetection] = useState(false)
    const [hasCopied, setHasCopied] = useState(false)
    const toast = useToast()
    const { isSupported: isPasskeySupported, isLoading: isLoadingPasskeySupport } = usePasskeySupportContext()
    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        if (!isPasskeySupported && !isLoadingPasskeySupport) {
            setShowInAppBrowserModalViaDetection(true)
        }
    }, [isPasskeySupported, isLoadingPasskeySupport])

    // Cleanup timeout on unmount to prevent memory leak
    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current)
            }
        }
    }, [])

    if (!showInAppBrowserModalViaDetection && !visible) {
        return null
    }

    const handleModalClose = () => {
        if (allowClose) {
            setShowInAppBrowserModalViaDetection(false)
        }
    }

    const copyLinkAction: ActionModalButtonProps[] = [
        {
            text: hasCopied ? t('unsupportedBrowserModal.copied') : t('unsupportedBrowserModal.copyLinkCta'),
            icon: 'copy' as IconName,
            iconPosition: 'left',
            onClick: async () => {
                try {
                    // Clear any existing timeout to prevent multiple resets
                    if (copyTimeoutRef.current) {
                        clearTimeout(copyTimeoutRef.current)
                    }

                    // copy the redirect uri if it exists, otherwise copy the current url
                    const redirectUri = searchParams.get('redirect_uri')
                    const urlToCopy = redirectUri
                        ? `${window.location.origin}${decodeURIComponent(redirectUri)}`
                        : window.location.href
                    await copyTextToClipboardWithFallback(urlToCopy)
                    setHasCopied(true)
                    toast.success(t('unsupportedBrowserModal.copySuccessToast'))
                    copyTimeoutRef.current = setTimeout(() => setHasCopied(false), 2000)
                } catch (err) {
                    console.error('Failed to copy: ', err)
                    toast.error(t('unsupportedBrowserModal.copyErrorToast'))
                }
            },
            className: 'bg-primary-1 hover:bg-primary-2 text-black sm:py-3',
            shadowSize: '4',
        },
        {
            variant: 'transparent-dark',
            className: 'text-grey-1 text-xs font-medium h-2 mt-1 hover:text-grey-1 active:text-grey-1',
            text: t('unsupportedBrowserModal.pasteHint'),
        },
    ]

    return (
        <ActionModal
            visible={true}
            onClose={handleModalClose}
            title={t('unsupportedBrowserModal.title')}
            description={t('unsupportedBrowserModal.description')}
            icon={'alert' as IconName}
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={copyLinkAction}
            hideModalCloseButton={!allowClose}
            modalPanelClassName="max-w-md"
            contentContainerClassName="text-center"
            descriptionClassName="mb-0"
            ctaClassName="flex-col sm:flex-col"
        />
    )
}

// suspense is being used to prevent hydration errors that may be caused by useSearchParams
const UnsupportedBrowserModal = (props: { allowClose?: boolean; visible?: boolean }) => {
    return (
        <Suspense fallback={null}>
            <UnsupportedBrowserModalContent {...props} />
        </Suspense>
    )
}

export default UnsupportedBrowserModal
