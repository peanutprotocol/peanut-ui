'use client'

import { Icon } from '@/components/Global/Icons/Icon'
import { LinkButton } from '@/components/0_Bruddle/LinkButton'
import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'

/** "Report an issue" footer link shared by every receipt variant. */
export const ReceiptSupportLink = () => {
    const { setIsSupportModalOpen } = useModalsContext()
    const t = useTranslations('transaction')

    return (
        // board Link Button (17980:18031) with the peanut-support trailing icon
        <LinkButton onClick={() => setIsSupportModalOpen(true)} className="w-full justify-center">
            {t('actions.reportIssue')}
            <Icon name="peanut-support" size={14} className="text-foreground-secondary" />
        </LinkButton>
    )
}
