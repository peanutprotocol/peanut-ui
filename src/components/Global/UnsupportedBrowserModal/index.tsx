'use client'

import ActionModal, { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { useToast } from '@/components/0_Bruddle/Toast'
import { type IconName } from '@/components/Global/Icons/Icon'
import { copyTextToClipboard } from '@/utils/clipboard.utils'
import { useEffect, useState, Suspense, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { isLikelyWebview } from '@/components/Setup/Setup.utils'

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
    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        // This modal tells people to leave an in-app browser. Do not use
        // conditional-mediation/passkey-autofill support as a proxy: it is an
        // optional WebAuthn feature and can be false in supported Chrome and
        // Safari sessions.
        setShowInAppBrowserModalViaDetection(isLikelyWebview())
    }, [])

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
                    if (!(await copyTextToClipboard(urlToCopy))) {
                        toast.error(t('unsupportedBrowserModal.copyErrorToast'))
                        return
                    }
                    setHasCopied(true)
                    toast.success(t('unsupportedBrowserModal.copySuccessToast'))
                    copyTimeoutRef.current = setTimeout(() => setHasCopied(false), 2000)
                } catch (err) {
                    console.error('Failed to copy: ', err)
                    toast.error(t('unsupportedBrowserModal.copyErrorToast'))
                }
            },
            className: 'bg-action-primary hover:bg-action-primary-hover text-black sm:py-3',
            shadowSize: '4',
        },
        {
            variant: 'transparent-dark',
            className:
                'text-foreground-secondary text-body-xs font-medium h-2 mt-1 hover:text-foreground-secondary active:text-foreground-secondary',
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
            iconContainerClassName="bg-action-primary"
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
