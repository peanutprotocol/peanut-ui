'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'

/** "Report an issue" footer link shared by every receipt variant. */
export const ReceiptSupportLink = () => {
    const { setIsSupportModalOpen } = useModalsContext()
    const t = useTranslations('transaction')

    return (
        <button
            onClick={() => setIsSupportModalOpen(true)}
            className="flex w-full items-center justify-center gap-2 text-body-s font-medium text-foreground-secondary underline transition-colors duration-instant hover:text-foreground-primary"
        >
            <Icon name="peanut-support" size={16} className="text-foreground-secondary" />
            {t('actions.reportIssue')}
        </button>
    )
}
