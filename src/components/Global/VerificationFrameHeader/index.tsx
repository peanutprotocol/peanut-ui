'use client'

import { useTranslations } from 'next-intl'
import { Icon } from '@/components/Global/Icons/Icon'

const BUTTON_CLASSES =
    'relative p-1 transition-opacity duration-instant after:absolute after:-inset-2 focus-visible:outline-[3px] focus-visible:outline-action-focus active:opacity-60'

/** header row above a full-screen verification iframe: support on the left, close on the right */
const VerificationFrameHeader = ({ onSupport, onClose }: { onSupport: () => void; onClose: () => void }) => {
    const tCommon = useTranslations('common')
    return (
        <div className="flex items-center justify-between px-4 py-2">
            <button
                type="button"
                aria-label={tCommon('contactSupport')}
                onClick={onSupport}
                className={`flex items-center ${BUTTON_CLASSES}`}
            >
                <Icon name="peanut-support" size={20} className="text-foreground-secondary" />
            </button>
            <button type="button" aria-label={tCommon('close')} onClick={onClose} className={BUTTON_CLASSES}>
                <Icon name="cancel" size={20} />
            </button>
        </div>
    )
}

export default VerificationFrameHeader
