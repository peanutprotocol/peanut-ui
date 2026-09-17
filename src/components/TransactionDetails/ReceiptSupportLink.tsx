'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useModalsContext } from '@/context/ModalsContext'
import { useAppTranslations } from '@/i18n/app/useAppTranslations'

/** "Report an issue" footer link shared by every receipt variant. */
export const ReceiptSupportLink = () => {
    const { setIsSupportModalOpen } = useModalsContext()
    const t = useAppTranslations('transaction')

    return (
        // Keep the support mark before the question so the action scans icon-first.
        <LinkButton onClick={() => setIsSupportModalOpen(true)} className="w-full justify-center print:hidden">
            <Icon name="peanut-support" size={14} className="text-foreground-secondary" />
            {t('actions.reportIssue')}
        </LinkButton>
    )
}
