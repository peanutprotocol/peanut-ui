'use client'

import { useModalsContext } from '@/context/ModalsContext'
import { useTranslations } from 'next-intl'

// Opens the in-app support drawer (Crisp). There is no /support page, so a
// Link there dead-ends (and bounces to home in the native static export).
const SupportCTA = () => {
    const t = useTranslations('global')
    const { openSupportWithMessage } = useModalsContext()
    return (
        <div className="flex flex-col items-center justify-center">
            <button
                type="button"
                onClick={() => openSupportWithMessage(t('supportCta.prefilledMessage'))}
                className="mt-2 cursor-pointer text-sm text-grey-1 underline underline-offset-2"
            >
                {t('supportCta.needHelp')}
            </button>
        </div>
    )
}

export default SupportCTA
