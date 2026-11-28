'use client'

import { useTranslations } from 'next-intl'
import { VerifyHeroLayout } from './VerifyLayout'

export function ResidenceNotSupportedScreen({ onBack }: { onBack: () => void }) {
    const t = useTranslations('kyc')
    return <VerifyHeroLayout pose="sad" title={t('residenceNotSupported')} onBack={onBack} footer={null} />
}
