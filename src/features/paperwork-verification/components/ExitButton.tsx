'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { NAV_CIRCLE_BUTTON_CLASSES } from '@/components/Global/NavHeader/navHeader.consts'
import { twMerge } from '@/utils/tw'

/** The page's own close, top right: it leaves the flow, it never closes a drawer. */
export function ExitButton({ onClick }: { onClick: () => void }) {
    const t = useTranslations('kyc.paperworkVerification')
    return (
        <Button
            variant="ghost"
            onClick={onClick}
            className={twMerge(NAV_CIRCLE_BUTTON_CLASSES, 'bg-white')}
            aria-label={t('documentList.close')}
            data-testid="verify-id-exit"
        >
            <Icon name="cancel" size={20} />
        </Button>
    )
}
