'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'

/** "Report an issue" footer link shared by every receipt variant. */
export const ReceiptSupportLink = () => {
    const { setIsSupportModalOpen } = useModalsContext()
    const t = useTranslations('transaction')

    return (
        // board Link Button (17980:18031): Body/XS underline, foreground/secondary,
        // trailing icon
        <button
            onClick={() => setIsSupportModalOpen(true)}
            className="flex w-full items-center justify-center gap-1 text-body-xs text-foreground-secondary underline transition-colors duration-instant hover:text-foreground-primary"
        >
            {t('actions.reportIssue')}
            <Icon name="peanut-support" size={14} className="text-foreground-secondary" />
        </button>
    )
}
