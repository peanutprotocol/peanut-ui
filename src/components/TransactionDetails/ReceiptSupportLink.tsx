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
        // the wrapper reserves the link's full 44px hit area (its ::after
        // extends 14px past the 16px text row) so a button grouped above can
        // never sit inside the touch target. keep the support mark before
        // the question so the action scans icon-first.
        <div className="flex min-h-11 w-full items-center justify-center print:hidden">
            <LinkButton onClick={() => setIsSupportModalOpen(true)} className="w-full justify-center">
                <Icon name="peanut-support" size={14} className="text-foreground-secondary" />
                {t('actions.reportIssue')}
            </LinkButton>
        </div>
    )
}
