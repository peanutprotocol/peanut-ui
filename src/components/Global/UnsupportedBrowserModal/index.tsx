'use client'

import ActionModal, { ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useToast } from '@/components/0_Bruddle/Toast'
import { IconName } from '@/components/Global/Icons/Icon'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { useEffect, useState } from 'react'

export const inAppSignatures = [
    'WebView',
    '(iPhone|iPod|iPad)(?!.*Safari\\/)', // iOS WebView
    'Android.*wv', // Android WebView
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
]

const UnsupportedBrowserModal = ({
    allowClose = true,
    visible = false,
}: {
    allowClose?: boolean
    visible?: boolean
}) => {
    const [showInAppBrowserModalViaDetection, setShowInAppBrowserModalViaDetection] = useState(!visible || false)
    const [copyButtonText, setCopyButtonText] = useState('Copy Link')
    const toast = useToast()

    useEffect(() => {
        // in-app browser detection - only run if not manually triggered
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            const ua = navigator.userAgent || navigator.vendor || (window as any).opera

            let isLikelyInApp = inAppSignatures.some((sig) => new RegExp(sig, 'i').test(ua))

            const isStandalonePWA = window.matchMedia('(display-mode: standalone)').matches
            if (isStandalonePWA) {
                isLikelyInApp = false
            }

            const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream
            if (isIOS && !isLikelyInApp && !/Safari|CriOS|FxiOS|EdgiOS/.test(ua)) {
                isLikelyInApp = true
            }

            if (isLikelyInApp) {
                setShowInAppBrowserModalViaDetection(true)
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
            text: copyButtonText,
            icon: 'copy' as IconName,
            iconPosition: 'left',
            onClick: async () => {
                try {
                    await copyTextToClipboardWithFallback(window.location.href)
                    setCopyButtonText('Copied!')
                    toast.success('Link copied to clipboard!')
                    setTimeout(() => setCopyButtonText('Copy Link'), 2000)
                } catch (err) {
                    console.error('Failed to copy: ', err)
                    toast.error('Failed to copy link.')
                }
            },
            className: 'bg-primary-1 hover:bg-primary-2 text-black',
            shadowSize: '4',
        },
        {
            variant: 'transparent-dark',
            className: 'text-grey-1 text-xs font-medium h-2 mt-1 hover:text-grey-1 active:text-grey-1',
            text: 'Then paste it in your preferred browser.',
        },
    ]

    return (
        <ActionModal
            visible={true}
            onClose={handleModalClose}
            title="Open this link in your browser"
            description={
                "Peanut doesn't work inside this app because of browser limitations. To continue, please open this link in your default browser."
            }
            icon={'alert' as IconName}
            iconContainerClassName="bg-primary-1"
            iconProps={{ className: 'text-black' }}
            ctas={copyLinkAction}
            hideModalCloseButton={!allowClose}
            modalPanelClassName="max-w-md"
            contentContainerClassName="text-center"
            descriptionClassName="mb-0"
        />
    )
}

export default UnsupportedBrowserModal
