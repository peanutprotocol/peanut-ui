'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@/components/0_Bruddle/Button'
import { Icon } from '@/components/Global/Icons/Icon'
import { useKycControl } from '@/features/paperwork-verification/analytics'

interface SumsubSdkErrorViewProps {
    onClose: () => void
    /** already-translated copy — next-intl message keys are typed, so callers resolve them */
    message: string
}

export const SumsubSdkErrorView = ({ onClose, message }: SumsubSdkErrorViewProps) => {
    const { track } = useKycControl('id-check', 'kyc_legacy')
    const tCommon = useTranslations('common')

    return (
        <div className="flex h-full flex-col items-center justify-center gap-4 p-8">
            <Icon name="alert" size={24} className="text-foreground-error" />
            <p className="text-center text-body-l font-medium">{message}</p>
            <Button
                variant="primary"
                shadowSize="4"
                onClick={() => {
                    track('close', 'tap')
                    onClose()
                }}
            >
                {tCommon('close')}
            </Button>
        </div>
    )
}
