'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'

interface SumsubSdkErrorViewProps {
    onClose: () => void
    /** already-translated copy — next-intl message keys are typed, so callers resolve them */
    message: string
}

export const SumsubSdkErrorView = ({ onClose, message }: SumsubSdkErrorViewProps) => {
    const tCommon = useTranslations('common')

    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <Icon name="alert" size={24} />
            <p className="text-center text-body-l font-medium">{message}</p>
            <Button variant="purple" shadowSize="4" onClick={onClose}>
                {tCommon('close')}
            </Button>
        </div>
    )
}
