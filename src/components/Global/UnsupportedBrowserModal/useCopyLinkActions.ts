'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useToast } from '@/components/0_Bruddle/Toast'
import { type ActionModalButtonProps } from '@/components/Global/ActionModal'
import { type IconName } from '@/components/Global/Icons/Icon'
import { copyTextToClipboard } from '@/utils/clipboard.utils'

type SearchParamsReader = Pick<URLSearchParams, 'get'>

export const useCopyLinkActions = (searchParams: SearchParamsReader): ActionModalButtonProps[] => {
    const t = useTranslations('global')
    const toast = useToast()
    const [hasCopied, setHasCopied] = useState(false)
    const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(
        () => () => {
            if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
        },
        []
    )

    const copyLink = async (): Promise<void> => {
        if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)

        try {
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
        } catch (error) {
            console.error('Failed to copy: ', error)
            toast.error(t('unsupportedBrowserModal.copyErrorToast'))
        }
    }

    return [
        {
            text: hasCopied ? t('unsupportedBrowserModal.copied') : t('unsupportedBrowserModal.copyLinkCta'),
            icon: 'copy' as IconName,
            iconPosition: 'left',
            onClick: copyLink,
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
}
