'use client'

import { useTranslations } from 'next-intl'
import { useSignupControl } from '@/features/setup/useSignupControl'
import { WhyWeAskSheet } from '@/features/paperwork-verification/components/WhyWeAskSheet'

/** "Why do we ask?" on Residence: the verify questions' sheet with its nationality reason (v7). */
export function ResidenceWhyLink() {
    const t = useTranslations('kyc.paperworkVerification')
    const { track } = useSignupControl()
    return (
        <WhyWeAskSheet
            link={t('whyAsk')}
            title={t('whyTitle')}
            reasons={[t('why.nationality'), t('whyShared')]}
            testId="setup-residence-why"
            onOpen={() => track('why', 'open')}
            onDismiss={() => track('why', 'dismiss')}
            onGotIt={() => track('why_got_it', 'tap')}
        />
    )
}
