'use client'

import { useToast } from '@/components/0_Bruddle/Toast'
import ActionModal, { ActionModalButtonProps } from '@/components/Global/ActionModal'
import * as Sentry from '@sentry/nextjs'
import { useCallback, useState } from 'react'

interface UnsupportedBrowserModalProps {
    visible: boolean
    onClose: () => void
}

const UnsupportedBrowserModal: React.FC<UnsupportedBrowserModalProps> = ({ visible, onClose }) => {
    const toast = useToast()
    const [isCopied, setIsCopied] = useState(false)

    const handleCopyLink = useCallback(async () => {
        if (typeof window === 'undefined') return
        try {
            await navigator.clipboard.writeText(window.location.href)
            toast.success('Link copied to clipboard!')
            setIsCopied(true)
            setTimeout(() => setIsCopied(false), 2000)
        } catch (err) {
            console.error('Failed to copy link:', err)
            toast.error('Failed to copy link.')
            Sentry.captureException(err)
        }
    }, [toast])

    const ctas: ActionModalButtonProps[] = [
        {
            text: isCopied ? 'Copied!' : 'Copy Link',
            onClick: handleCopyLink,
            icon: 'copy',
            iconPosition: 'left',
            variant: 'purple',
            disabled: isCopied,
            shadowSize: '4',
        },
    ]

    const descriptionNode = (
        <div className="text-center">
            <p className="text-sm text-grey-1 dark:text-white">
                Peanut doesn't work inside this app because of browser limitations. To continue, please open this link
                in your default browser.
            </p>
            <p className="mt-4 text-xs text-grey-2 dark:text-grey-3">Then paste it in your preferred browser.</p>
        </div>
    )

    return (
        <ActionModal
            visible={visible}
            onClose={onClose}
            title="Open this link in your browser"
            description={descriptionNode}
            icon="alert"
            ctas={ctas}
            modalClassName="w-full max-w-sm"
        />
    )
}

export default UnsupportedBrowserModal
