'use client'

import ActionModal, { ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useToast } from '@/components/0_Bruddle/Toast'
import { IconName } from '@/components/Global/Icons/Icon'
import { copyTextToClipboardWithFallback } from '@/utils/general.utils'
import { useEffect, useState } from 'react'

const UnsupportedBrowserModal = ({ allowClose = true }: { allowClose?: boolean }) => {
    const [showInAppBrowserModalViaDetection, setShowInAppBrowserModalViaDetection] = useState(false)
    const [copyButtonText, setCopyButtonText] = useState('Copy Link')
    const toast = useToast()

    useEffect(() => {
        // in-app browser detection - only run if not manually triggered
        if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
            const ua = navigator.userAgent || navigator.vendor || (window as any).opera
            const inAppSignatures = [
                'WebView',
                '(iPhone|iPod|iPad)(?!.*Safari\/)',
                'Android.*(wv|\.0\.0\.0)',
                'FBAN',
                'FBAV',
                'Instagram',
                'Twitter',
                'Snapchat',
                'Line',
                'WhatsApp',
                'WeChat',
                'TelegramBot',
                'Telegram',
                'Puffin',
            ]
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

    if (!showInAppBrowserModalViaDetection) {
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
